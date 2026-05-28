// Friendly label for a device, shown wherever a device is referenced.
// Falls back through admin-set name → MindLabs asset/reference → raw id.
export function deviceLabel(d) {
  if (!d) return '';
  return d.name || d.asset_name || d.personal_reference || d.id;
}
