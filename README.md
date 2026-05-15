# Proca Express

Device tracking webapp — live at [tracking.procaexpress.in](https://tracking.procaexpress.in/).

## Stack

| Layer       | Choice |
|-------------|--------|
| Frontend    | React 18 + React Router (Vite), port **3000** |
| Backend API | Node.js + Express 4 (JSON only), port **5000** |
| Database    | PostgreSQL on AWS RDS (`pg` driver, SSL) |
| Auth        | JWT in signed httpOnly cookies, bcrypt password hashes |
| Email       | nodemailer (SMTP) |
| Bot check   | Google reCAPTCHA v2/v3 |
| Hosting     | AWS EC2 + nginx reverse proxy + pm2 + Certbot |

## Repo layout

```
proca_express/
├── backend/                  # Express JSON API (port 5000)
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js           # /api/auth/*
│   │   ├── public.js         # /api/register-request
│   │   ├── user.js           # /api/devices
│   │   └── admin.js          # /api/admin/*
│   ├── utils/{mailer.js,recaptcha.js}
│   ├── db/{schema.sql,init.js,check.js}
│   └── .env.example
└── frontend/                 # React SPA (port 3000)
    ├── index.html
    ├── vite.config.js        # /api → http://localhost:5000 proxy in dev
    └── src/
        ├── main.jsx, App.jsx
        ├── api.js, styles.css
        ├── auth/AuthContext.jsx
        ├── components/{UserNav,AdminNav}.jsx
        └── pages/{Login,RegisterRequest,ResetPassword,Home,admin/*}.jsx
```

## API surface

```
POST   /api/auth/login                  { identifier, password }
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/forgot-password        { email }
POST   /api/auth/reset-password         { token, password }
POST   /api/register-request            { email, mobile, ... }
GET    /api/devices                     (auth-gated)

POST   /api/admin/auth/login            { email, password }
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
GET    /api/admin/stats
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
```

## Local dev

```powershell
# Backend (port 5000)
cd backend
Copy-Item .env.example .env   # fill in PG + secrets
npm install
npm run db:init               # applies schema, seeds bootstrap admin
npm run dev

# Frontend (port 3000)
cd ../frontend
npm install
npm run dev
```

Open http://localhost:3000 — the Vite dev server proxies `/api/*` to the backend on 5000, so cookies just work.

## Production (EC2 + nginx)

- `backend/` runs under pm2 as `proca-api` on `127.0.0.1:5000`
- `frontend/` is built (`npm run build`) and the resulting `dist/` is served statically by nginx
- nginx terminates TLS on 443, serves `/` from `frontend/dist`, and reverse-proxies `/api/*` to `127.0.0.1:5000`
- Neither 3000 nor 5000 should be exposed in the EC2 security group — only 80/443/22

## What's stubbed (future phases)
- **Devices**: schema + dashboard placeholder, no provisioning UI yet
- **Mailer**: when `SMTP_HOST` is empty the mailer logs to console instead of failing
- **reCAPTCHA**: skipped when `RECAPTCHA_SECRET_KEY` is empty
