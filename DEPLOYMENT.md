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
* **Password:** `admin123`

*(Please log in and update your password under the Team Management tab if desired.)*

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
