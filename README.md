# J Square Photography CRM & Invoicing Platform

A modern, cloud-based, full-stack Customer Relationship Management (CRM) and Invoicing platform engineered specifically for **J Square Photography** (Singapore).

Designed from the ground up to operate on **100% free-tier hosting infrastructure** with zero recurring subscription fees.

---

## 🌟 Key Features

### 1. Role-Based Access Control (RBAC) & Team Management
* **SuperAdmin & Manager Roles:** SuperAdmin retains exclusive authority to provision accounts, toggle active status, and manage studio settings.
* **Stateless Session Security:** Cryptographic JWTs signed via `jose` stored in `HttpOnly`, `SameSite=Lax`, `Secure` browser cookies.
* **Middleware Route Protection:** Protected `/admin/*` boundary with automatic redirects.

### 2. Client Management Directory & Autocomplete CRM
* **Central Client Directory:** Searchable repository with Singapore UEN, primary contact, email, phone, socials, and private internal notes.
* **Client Autocomplete:** When creating new projects or invoices, typing a client name automatically queries and autocompletes from existing records, preventing typos and duplicates.
* **Interactive Project Pipeline:** 6-stage workflow tracker (`Inquiry` → `Quoted` → `Booked` → `In Progress` → `Delivered` → `Closed`) with a clickable horizontal visual stepper.

### 3. Invoicing Engine & Singapore PayNow SGQR Generator
* **Automated Sequential Numbering:** `JSQ-YYYY-XXXX`.
* **Singapore GST Support:** Configurable 9% Singapore Goods and Services Tax calculation toggle.
* **Dynamic EMVCo SGQR Engine:** Dynamically generates scannable PayNow QR codes encoding J Square Photography's UEN, exact SGD invoice amount, and bill reference. Verified compatible with **DBS PayLah!, OCBC, UOB, Standard Chartered, and GrabPay**.
* **Single-Invoice Milestone & Partial Payment Ledger:** Record multiple installments (e.g. 50% booking deposit + 50% final balance) with automatic status transitions (`Draft` → `Sent` → `Partial` → `Paid`).

### 4. Zero-Cost Client-Facing E-Signature Portal
* **Zero Account Required:** Clients access their agreement via a single unique 64-character unguessable URL token (`/sign?token=...`).
* **HTML5 Canvas Signature Pad:** Touch/stylus-optimized with anti-aliasing and retina DPI scaling (`devicePixelRatio`).
* **Singapore ETA 2010 Compliance:** Mandatory legal consent acknowledgment checkbox.
* **Tamper-Proof Audit Trail:** Server automatically captures signer identity, client IP, User-Agent, UTC timestamp, and a **cryptographic SHA-256 document fingerprint**.
* **Replay Protection:** Permanent state lock prevents duplicate signatures.

### 5. Serverless PDF Compilers (Zero Chromium)
* Compiles high-resolution, branded A4 PDFs directly inside serverless functions in < 50ms using `pdf-lib` (zero Puppeteer/Chromium memory overhead).
* **Invoice PDF:** Studio header, UEN, client details, line items table, GST breakdown, and embedded PayNow SGQR code image.
* **Signed Contract PDF:** Complete legal clauses, hand-drawn signature raster, and the stamped **Electronic Signature Audit Trail Certificate**.

### 6. Automated Overdue Sweeper & Internal Alerting
* **Vercel Cron Trigger:** Scheduled daily at **00:00 SGT (16:00 UTC)** via `vercel.json`.
* **Multi-Channel Dispatcher:** Rich embeds to Discord, Slack Block Kit messages, and Resend email digests.
* **Strict Studio Policy:** Strictly internal alerts to studio management. **No automated emails are ever sent directly to clients.**

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|:---|:---|:---|
| **Framework** | Next.js 16 (App Router) | High-performance full-stack React framework with Turbopack |
| **Language** | TypeScript | Strict type checking and end-to-end type safety |
| **Styling** | Tailwind CSS v4 | Modern utility-first styling with zero config overhead |
| **Database ORM** | Prisma 5 | SQLite for local development; PostgreSQL (Supabase/Neon) for production |
| **Security & Auth** | `jose` & `bcryptjs` | Cryptographic JWT signing and salted bcrypt password hashing |
| **QR Code Engine** | `qrcode` + Custom EMVCo | Singapore PayNow SGQR generator with CRC16-CCITT checksum |
| **PDF Generation** | `pdf-lib` | Serverless native PDF generation with zero external dependencies |
| **Icons** | Lucide React | Clean, modern iconography |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js v18+ or v20+
- npm or yarn

### 2. Setup & Installation
```bash
# Clone the repository
git clone https://github.com/[YOUR-ORG]/jsquare-crm.git
cd jsquare-crm

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Initialize database schema
npm run db:push

# Seed the SuperAdmin account
npm run db:seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Default SuperAdmin Credentials:**
* **Email:** `admin@jsquarephotography.com`
* **Password:** `admin123`

---

## 🧪 Running Automated Tests

Run the master end-to-end integration test suite verifying all 13 milestones:
```bash
npx tsx scratch/master_e2e_test.ts
```

---

## ☁️ Free-Tier Production Deployment

For complete instructions on deploying to **Vercel (Frontend & Serverless)** and **Supabase (PostgreSQL)** for **$0.00/month**, consult the **[DEPLOYMENT.md](file:///c:/Personal%20Projects/Invoice%20App/DEPLOYMENT.md)** guide.

---

## 📄 License

Proprietary software developed exclusively for **J Square Photography** (Singapore). All rights reserved.
