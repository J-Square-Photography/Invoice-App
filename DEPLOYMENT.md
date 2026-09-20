# J Square Photography CRM — Production Deployment Record

## 🌐 Live Production URL
**[https://jsquare-crm.vercel.app](https://jsquare-crm.vercel.app)**

---

## 🗄️ Connected Infrastructure (100% Free-Tier)

| Service | Configuration | Region | Status |
|:---|:---|:---|:---:|
| **Frontend & API Routes** | **Vercel** (`jsquare-crm`) | Global Edge CDN | **LIVE** |
| **PostgreSQL Database** | **Supabase** (`ypqlgjiuqfkrepiznwam`) | Singapore (`ap-southeast-1`) | **LIVE** |
| **Daily Overdue Sweeper** | **Vercel Cron** (`0 16 * * *` UTC = 00:00 SGT) | `/api/cron/overdue-sweeper` | **ACTIVE** |
| **PDF Generation** | Serverless `pdf-lib` (< 50ms) | Built-in | **ACTIVE** |
| **E-Signature Portal** | Native HTML5 Canvas + SHA-256 | `/sign?token=...` | **ACTIVE** |

---

## 🔑 Initial SuperAdmin Credentials

* **Login URL:** [https://jsquare-crm.vercel.app/login](https://jsquare-crm.vercel.app/login)
* **Email:** `admin@jsquarephotography.com`
* **Password:** set via the `SEED_ADMIN_PASSWORD` environment variable at seed time, or the one-time generated password printed to the seed script's console output.

**Do not record real credentials in this file.** If this account was ever seeded with the password `admin123`, treat it as compromised — log in and rotate it under Team Management immediately, and see the credential rotation note below.

---

## 🧪 Production Verification Log

| Test | Production Endpoint | Result |
|:---|:---|:---:|
| **Web Portal Health** | `GET https://jsquare-crm.vercel.app/login` | ✅ HTTP 200 OK |
| **Live Database Authentication** | `POST https://jsquare-crm.vercel.app/api/auth/login` | ✅ Verified (Logged in as SuperAdmin) |
| **Client Signing Portal** | `GET https://jsquare-crm.vercel.app/sign` | ✅ HTTP 200 OK |
| **Automated Overdue Sweeper** | `GET https://jsquare-crm.vercel.app/api/cron/overdue-sweeper` | ✅ Verified (`TriggeredBy: Vercel_Cron`) |
| **EMVCo PayNow SGQR Engine** | Serverless Dynamic Generator | ✅ Active |
| **Serverless PDF Compiler** | Native Node.js `pdf-lib` | ✅ Active |

---

## 🔐 Required Environment Variables (Vercel Project Settings)

See `.env.example` for the full list and generation instructions. At minimum, production needs:
`DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`. The app now fails to start if `JWT_SECRET` is unset —
this is intentional (see credential rotation note below).

## ⚠️ Credential Rotation Log

`scratch/` was previously committed to this repository with a live Vercel API token, the Supabase
database password, and the SuperAdmin password in plaintext. That directory is no longer tracked,
but the values remain in git history. Rotation status:

- [ ] Vercel API token revoked and reissued
- [ ] Supabase database password reset, `DATABASE_URL` updated in Vercel project settings
- [ ] SuperAdmin password changed away from any value that appeared in `scratch/`
- [ ] `JWT_SECRET` / `CRON_SECRET` set to freshly generated values in Vercel project settings
- [ ] (optional) git history rewritten to purge the old secrets from old commits
