const express = require('express');
const router = express.Router();
const { query, pool } = require('../config/db');

// ============================================================
// MindLabs webhook receiver
// ============================================================
//
// Configured at app.mindlabs.cloud → Settings → Integrations → Webhooks.
// MindLabs POSTs envelopes of the form:
//
//   {
//     timestamp: 1709316704,
//     signature: "...",
//     payload: {
//       type: "packets",
//       data: {
//         id: "AA3630",                  // device id
//         personalReference: "NEWGO1",   // optional
//         assetName: "Chamber No. 4",    // optional
//         packets: [{ timestamp, battery, tempI, humidI, location?, ... }, ...]
//       }
//     }
//   }
//
// We:
//   1. Optionally check the URL ?token=... matches MINDLABS_WEBHOOK_TOKEN.
//      (The PDF doesn't specify a verifiable signature algorithm; until they
//      do, we treat the URL-token as the only realistic auth.)
//   2. Store the raw envelope in webhook_events for audit/replay.
//   3. Auto-upsert the device row if we haven't seen it before.
//   4. Insert one row per packet into device_packets (de-duped via UNIQUE
//      (device_id, packet_time)).
//   5. Refresh the device's denormalised "last_*" fields from the most
//      recent packet.
//   6. Always respond 200 OK quickly so MindLabs doesn't retry. Errors get
//      logged but never fail the response — once we've persisted the raw
//      envelope, we can always reprocess later.

const ALLOWED_TYPES = new Set(['packets']);
// Defensive cap. MindLabs typically batches a handful of packets per webhook;
// a payload with thousands likely indicates a misconfiguration or replay loop.
const MAX_PACKETS_PER_ENVELOPE = 1000;

router.post('/mindlabs/webhook', async (req, res) => {
  const expectedToken = process.env.MINDLABS_WEBHOOK_TOKEN;
  if (expectedToken && req.query.token !== expectedToken) {
    return res.status(401).json({ error: 'bad_token' });
  }

  const env = req.body || {};
  const sig = String(env.signature || '');
  const payloadType = env?.payload?.type;
  const data = env?.payload?.data || {};
  const packets = Array.isArray(data.packets) ? data.packets : [];

  // Always log the raw envelope — even malformed ones — so we can debug.
  const auditId = await logEnvelope(env, sig, packets.length).catch((e) => {
    console.error('[mindlabs] audit log failed', e);
    return null;
  });

  if (!ALLOWED_TYPES.has(payloadType)) {
    return res.status(202).json({ ok: true, ignored: payloadType, audit_id: auditId });
  }
  if (!data.id || !packets.length) {
    return res.status(202).json({ ok: true, ignored: 'empty', audit_id: auditId });
  }
  if (packets.length > MAX_PACKETS_PER_ENVELOPE) {
    return res.status(413).json({ error: 'too_many_packets', limit: MAX_PACKETS_PER_ENVELOPE, audit_id: auditId });
  }

  try {
    await ingestPackets(data);
    res.json({ ok: true, audit_id: auditId, packets: packets.length });
  } catch (err) {
    console.error('[mindlabs] ingest failed', err);
    // Even on ingest failure, return 2xx so MindLabs marks delivery as OK —
    // the raw envelope is in webhook_events and a reprocessor can pick it up.
    res.status(202).json({ ok: false, audit_id: auditId, error: 'ingest_deferred' });
  }
});

async function logEnvelope(env, sig, packetCount) {
  const { rows } = await query(
    `INSERT INTO webhook_events (source, payload_timestamp, signature, packet_count, raw)
     VALUES ('mindlabs', $1, $2, $3, $4) RETURNING id`,
    [Number.isFinite(env.timestamp) ? env.timestamp : null, sig || null, packetCount, env]
  );
  return rows[0]?.id || null;
}

async function ingestPackets(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert the device row. Don't trample user_id if it was already assigned.
    await client.query(
      `INSERT INTO devices (id, asset_name, personal_reference)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         asset_name         = COALESCE(EXCLUDED.asset_name, devices.asset_name),
         personal_reference = COALESCE(EXCLUDED.personal_reference, devices.personal_reference)`,
      [data.id, data.assetName || null, data.personalReference || null]
    );

    let latest = null;
    for (const p of data.packets) {
      // packet.timestamp is a 10-digit unix seconds value.
      const t = Number(p.timestamp);
      if (!Number.isFinite(t)) continue;
      const packetTime = new Date(t * 1000);
      const loc = p.location || {};
      await client.query(
        `INSERT INTO device_packets
           (device_id, packet_time, battery, time_interval, temp_i, temp_p1, humid_i,
            light, shock, lat, lng, formatted_address, raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (device_id, packet_time) DO NOTHING`,
        [
          data.id, packetTime,
          numOr(p.battery), numOr(p.timeInterval),
          numOr(p.tempI), numOr(p.tempP1), numOr(p.humidI),
          numOr(p.alsLux), numOr(p.imuMagnitude),
          numOr(loc.lat), numOr(loc.lng), loc.formatted_address || null,
          p,
        ]
      );
      if (!latest || t > latest.t) latest = { t, p, loc };
    }

    if (latest) {
      const lt = latest.t, lp = latest.p, lloc = latest.loc;
      await client.query(
        `UPDATE devices SET
           last_seen_at  = to_timestamp($2),
           last_battery  = $3,
           last_temp_i   = $4,
           last_humid_i  = $5,
           last_light    = $6,
           last_shock    = $7,
           last_lat      = COALESCE($8, last_lat),
           last_lng      = COALESCE($9, last_lng),
           last_address  = COALESCE($10, last_address)
         WHERE id = $1
           AND (last_seen_at IS NULL OR last_seen_at < to_timestamp($2))`,
        [
          data.id, lt,
          numOr(lp.battery), numOr(lp.tempI), numOr(lp.humidI),
          numOr(lp.alsLux), numOr(lp.imuMagnitude),
          numOr(lloc.lat), numOr(lloc.lng), lloc.formatted_address || null,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function numOr(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Tiny GET so you can curl the URL in a browser to confirm the route is wired.
router.get('/mindlabs/webhook', (_req, res) => {
  res.json({ ok: true, hint: 'POST your MindLabs webhook envelopes here.' });
});

module.exports = router;
