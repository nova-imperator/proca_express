# Proca Express

Device tracking webapp — live at [tracking.procaexpress.in](https://tracking.procaexpress.in/).

## Stack

| Layer       | Choice |
|-------------|--------|
| Runtime     | Node.js 18+ / Express 4 |
| Templates   | EJS (server-rendered) |
| Database    | PostgreSQL (AWS RDS) via `pg` |
| Auth        | JWT in signed httpOnly cookies, bcrypt password hashes |
| Email       | nodemailer (SMTP) |
| Bot check   | Google reCAPTCHA v2/v3 |
| Hosting     | AWS EC2 + nginx + pm2 + Certbot |

## Project layout

```
proca_express/
├── server.js              # entry point
├── config/db.js           # pg connection pool
├── middleware/auth.js     # JWT cookie helpers + guards
├── routes/
│   ├── public.js          # /register-request
│   ├── auth.js            # /login, /logout, /forgot-password, /reset-password
│   ├── user.js            # /home (auth-gated)
│   └── admin.js           # /admin/* (admin login, dashboard, users CRUD)
├── utils/
│   ├── mailer.js          # nodemailer wrapper (stub when SMTP unset)
│   └── recaptcha.js       # Google siteverify
├── views/                 # EJS templates
│   ├── partials/          # head / foot / nav
│   └── admin/             # admin views
├── public/css/app.css     # shared styles
├── db/
│   ├── schema.sql         # PostgreSQL schema
│   └── init.js            # applies schema + seeds bootstrap admin
├── .env.example
└── package.json
```

## Page → route map

**User**
| Page | URL |
|---|---|
| Login | `GET /` |
| Register request | `GET/POST /register-request` |
| Forgot password (popup) | `POST /forgot-password` (JSON), `GET/POST /reset-password` |
| User dashboard | `GET /home` (auth-gated) |

**Admin**
| Page | URL |
|---|---|
| Admin login | `GET /admin`, `POST /admin/login` |
| Admin dashboard | `GET /admin/home` |
| Users list | `GET /admin/users` |
| Add user | `GET/POST /admin/add-user` |
| Edit user | `GET/POST /admin/edit-user/:id` |
| Delete user | `POST /admin/users/:id/delete` |

## Local setup

```powershell
# 1. Install deps
npm install

# 2. Set up env
Copy-Item .env.example .env
# fill in real DB + SMTP values

# 3. Create DB locally (or point .env at RDS)
psql -U postgres -c "CREATE DATABASE proca_express;"

# 4. Apply schema + seed bootstrap admin
npm run db:init

# 5. Start dev server
npm run dev
```

App boots at `http://localhost:3000`.

## AWS deployment outline

### RDS (PostgreSQL)
1. Create a PostgreSQL instance (engine 15+, single AZ for dev).
2. Security group: allow inbound 5432 **only from the EC2 SG**, not 0.0.0.0/0.
3. Note the endpoint and put it in `.env` as `PGHOST`. Set `PGSSL=true`.
4. On first deploy: `npm run db:init` from the EC2 host.

### EC2
1. Ubuntu 22.04 LTS, t3.small or larger.
2. Install Node 18 + nginx + certbot.
3. Clone the repo to `/srv/proca_express`, `npm ci`, `npm run db:init`.
4. Run under pm2: `pm2 start server.js --name proca-express`.
5. nginx reverse proxy on `tracking.procaexpress.in` → `127.0.0.1:3000`.
6. `certbot --nginx -d tracking.procaexpress.in` for TLS.

### Required env on the EC2 host
See `.env.example`. The fields blocking production:
- `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (RDS)
- `JWT_SECRET`, `COOKIE_SECRET` (32+ random bytes each)
- `SMTP_*` + `MAIL_FROM` + `MAIL_ADMIN_NOTIFY`
- `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`
- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (only used on first `db:init`)

## What's intentionally stubbed (later phases)
- **Devices**: schema and admin device-count tile exist, but no UI/API for managing them yet — flagged in `documentation 1.txt` as "later device details will be displayed".
- **Mailer fallback**: when `SMTP_HOST` is empty, `utils/mailer.js` logs intended sends to the console instead of failing — useful before SMTP creds are issued.
- **reCAPTCHA**: skipped automatically when `RECAPTCHA_SECRET_KEY` is empty, so dev runs without a key.

## Security notes
- Passwords hashed with bcrypt cost 12.
- JWTs stored in **signed**, **httpOnly** cookies — `secure` flag auto-enabled when `NODE_ENV=production`.
- `app.set('trust proxy', 1)` set for nginx — keep it pinned to the actual hop count.
- Login + forgot-password rate-limited to 20 req / 15 min per IP.
- Forgot-password response is identical whether the email exists or not (no enumeration).
- Reset tokens stored as SHA-256 hashes, single-use, 1-hour expiry.
