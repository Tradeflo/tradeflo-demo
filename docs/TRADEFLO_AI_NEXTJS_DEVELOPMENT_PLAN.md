# TRADEFLO AI - Backend Development Plan (Next.js API)

**Project**: Tradeflo AI Quote Builder  
**Stack**: Next.js (API routes), Supabase, Stripe, Resend, Twilio  
**Budget**: $3,000 CAD | **Timeline**: 4 weeks  
**Owner**: Abdul Saboor Khan  

**Authoritative requirements:** This plan is subordinate to **`docs/srs.txt`**. Onboarding **copy and UX** follow **`docs/onboarding-flow.txt`**. If anything here conflicts with the SRS, **implement the SRS**. This revision removes or defers items explicitly **out of scope** in SRS §5 and §9 (AI accuracy/calibration/guardrails, admin dashboard, advanced analytics, etc.).

---

## 📋 TABLE OF CONTENTS
1. [Project Overview](#project-overview)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Routes & Endpoints](#api-routes--endpoints)
6. [Authentication Flow](#authentication-flow)
7. [Integration Guides](#integration-guides)
8. [Development Phases](#development-phases) (mapped to SRS milestones)
9. [Setup Instructions](#setup-instructions)
10. [Deployment Checklist](#deployment-checklist)

---

## PROJECT OVERVIEW

### What We're Building (per SRS §1)
A **production-ready backend** for Canadian trades contractors that:
- ✅ Exposes authenticated APIs for accounts, profiles, and onboarding data (work logs uploaded **during onboarding**, SRS §4.5)
- ✅ Creates and stores quotes with **immutable sent versions** and **versioned line items** (SRS §4.2–4.3)
- ✅ Passes **structured inputs** (job details, extracted work-log text, optional images as base64) to **Anthropic** via a **server-side proxy** (SRS §4.6 — **no** obligation in this phase to optimize output, calibration, or guardrails)
- ✅ Sends quotes and notifications by **Resend** (email) and **Twilio** (SMS)
- ✅ Provides **customer approval / request-changes** via **one token per quote version**, **single server-validated action**, token **invalid after use** (SRS §4.4)
- ✅ Enforces **20 AI calls per user per day** server-side (SRS §4.7)
- ✅ Bills via **Stripe** with **7-day grace** after failed payment, then **read-only** mode (SRS §4.9)
- ✅ Generates **PDFs** from quote data (SRS §4.10)

### Current State
- ✅ **Contractor-facing frontend already deployed** (Netlify); it already talks to Anthropic for prototyping (SRS §1)
- ❌ **No** production auth, database, billing, or email/SMS tied to this backend

### What This Delivery Is
The **backend layer** only: API routes, Supabase schema and RLS, integrations, webhooks, and observability. **UI pages** for auth, dashboard, onboarding, and quote builder **remain in the existing frontend** unless you explicitly merge repos; this codebase is organized around **`app/api/*`** and shared `lib/` / `services/`.

### SRS — AI scope boundary (do not expand in this phase)
Per **SRS §5**: in-scope = **structured data in** and **clean transport to Anthropic**; **out of scope** = tuning **accuracy**, **calibration** as a product feature, **prompt optimization**, and **guardrails** (separate phase / technical advisor).

---

## TECH STACK & ARCHITECTURE

### Core Stack (aligned with SRS §3)
```
Contractor UI:          Existing frontend (Netlify) — consumes this API
API / SSR runtime:      Node.js 20+ (Next.js Route Handlers / API routes)
Database / Auth:        Supabase (PostgreSQL + Auth + Storage)
Email:                  Resend
SMS:                    Twilio
Billing:                Stripe
AI:                     Anthropic (Claude) — server-side only
PDF Generation:         PDFKit or Puppeteer
Error Logging:          Sentry + structured logs
Hosting (this backend): Netlify (or same Netlify project pattern as org standard)
```

### Architecture Diagram
```
┌──────────────────────┐      HTTPS        ┌─────────────────────────────┐
│ Existing frontend    │ ───────────────► │ Next.js API (Route Handlers) │
│ (Netlify)            │ ◄─────────────── │ Auth, quotes, webhooks       │
└──────────────────────┘                  ├─────────────────────────────┤
                                          │  Quotes + quote_versions     │
                                          │  Work logs, billing, PDF     │
├─────────────────────────────────────────┴─────────────────────────────┤
│ External: Supabase │ Stripe │ Resend │ Twilio │ Anthropic │ Sentry   │
└────────────────────────────────────────────────────────────────────────┘
```

### Non-Negotiable Requirements ✅
- All API keys stored server-side only (SRS §8)
- Rate limiting on AI generation (20/day per user, SRS §4.7)
- Error logging with full context (SRS §4.11)
- PIPEDA-aware handling; Canadian data residency where required (Supabase region)
- **Sent quote versions are immutable**; edits create **new versions** (SRS §4.2–4.3)
- **Approval tokens**: one per **sent** quote **version**; **one customer action** per token; then **invalid** (SRS §4.4)
- Full error handling & graceful degradation

---

## PROJECT STRUCTURE

Per **SRS §1**, the **contractor UI already exists** on Netlify. This repository is the **backend**: API routes, domain logic, and integration clients. The existing app calls these endpoints (and/or Supabase per your auth design).

Optional: a **minimal** Next.js `app/layout.tsx` / health page for ops only — **not** a replacement for the product UI. **PWA / dashboard pages** are **not** part of this backend delivery unless the frontend is merged into this repo.

```
tradeflo-ai-backend/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signup/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── refresh/route.ts
│   │   │
│   │   ├── onboarding/             # SRS §4.12 — business + work logs
│   │   │   ├── business/route.ts
│   │   │   ├── work-logs/upload/route.ts
│   │   │   ├── status/route.ts
│   │   │   └── complete/route.ts
│   │   │
│   │   ├── quotes/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── [id]/versions/route.ts
│   │   │   ├── [id]/generate/route.ts
│   │   │   ├── [id]/pdf/route.ts
│   │   │   ├── [id]/send/route.ts
│   │   │   └── [id]/photos/...
│   │   │
│   │   ├── public/quotes/
│   │   │   ├── [token]/route.ts
│   │   │   ├── [token]/approve/route.ts
│   │   │   └── [token]/request-changes/route.ts
│   │   │
│   │   ├── customers/route.ts
│   │   ├── work-logs/...
│   │   ├── billing/...
│   │   ├── webhooks/stripe/route.ts
│   │   ├── user/profile/route.ts
│   │   └── health/route.ts
│   │
│   └── (optional) layout.tsx, page.tsx
│
├── lib/
├── services/
├── types/
├── middleware.ts
├── .env.example
├── package.json
├── tsconfig.json
└── next.config.ts
```

**Frontend parity:** Onboarding **copy** is in **`docs/onboarding-flow.txt`**. The Netlify frontend implements those screens and consumes this API.

---

## DATABASE SCHEMA

### Supabase PostgreSQL Tables

#### 1. `users` (from Supabase Auth)
```sql
Table: auth.users (managed by Supabase)
- id (UUID) PRIMARY KEY
- email (VARCHAR)
- encrypted_password
- email_confirmed_at
- created_at
- updated_at
- last_sign_in_at
```

#### 2. `contractors`
```sql
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Business Details
  business_name VARCHAR(255) NOT NULL,
  business_owner_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  province VARCHAR(2),
  trade_type VARCHAR(100),
  hst_number VARCHAR(50),
  
  -- Subscription
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(50), -- 'active', 'canceled', 'past_due'
  subscription_plan VARCHAR(100),
  subscription_start_at TIMESTAMPTZ,
  subscription_end_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  billing_grace_period_ends_at TIMESTAMPTZ, -- SRS §4.9: failed payment → 7-day grace, then read-only
  account_read_only BOOLEAN DEFAULT FALSE,
  
  -- Billing Events Log
  last_charge_amount INT,
  last_charge_date TIMESTAMPTZ,
  billing_alert_sent BOOLEAN DEFAULT FALSE,
  
  -- Work logs (SRS §4.5) — extracted text included in AI input; not a "calibration" product feature in this phase
  work_logs_uploaded BOOLEAN DEFAULT FALSE,
  work_log_processing_status VARCHAR(50), -- 'none', 'pending', 'processing', 'complete', 'failed'
  
  -- Rate Limiting
  quote_generation_count INT DEFAULT 0,
  quote_generation_reset_at TIMESTAMPTZ DEFAULT now() + interval '1 day',
  
  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  
  -- Metadata
  logo_url TEXT,
  brand_color VARCHAR(7),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contractors_user_id ON contractors(user_id);
CREATE INDEX idx_contractors_stripe_customer_id ON contractors(stripe_customer_id);
```

#### 3. `quotes` (base record — SRS §4.3)
One row per quote thread. Mutable **metadata only**; financials, customer snapshot, and line items live on **`quote_versions`**.

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE (contractor_id, quote_number)
);

CREATE INDEX idx_quotes_contractor_id ON quotes(contractor_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
```

#### 4. `quote_versions` (immutable once `status = 'sent'` — SRS §4.2–4.3)
Each version stores a full **snapshot**: job fields, customer fields, totals, timestamps. **Edits after send** create a **new row** (new `version_number`), never mutate a sent row.

```sql
CREATE TABLE quote_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'draft', 'sent', 'approved', 'changes_requested'

  job_type VARCHAR(100),
  job_description TEXT,
  property_type VARCHAR(50),
  approx_sqft INT,
  site_address TEXT,
  preferred_start_window VARCHAR(100),
  scope_notes TEXT,

  customer_first_name VARCHAR(100),
  customer_last_name VARCHAR(100),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),

  total_price DECIMAL(10, 2),
  tax_amount DECIMAL(10, 2),
  tax_percentage DECIMAL(5, 2),
  currency VARCHAR(3) DEFAULT 'CAD',

  valid_for_days INT DEFAULT 30,
  valid_until TIMESTAMPTZ,

  ai_model_used VARCHAR(50),
  ai_prompt_version INT,
  ai_generated_at TIMESTAMPTZ,

  -- Client portal (SRS §4.4): one token per **version**; single use
  approval_token VARCHAR(255) UNIQUE,
  approval_token_expires_at TIMESTAMPTZ,
  approval_token_consumed_at TIMESTAMPTZ,
  client_approved_at TIMESTAMPTZ,
  client_view_count INT DEFAULT 0,
  client_last_viewed_at TIMESTAMPTZ,

  sent_via_email BOOLEAN DEFAULT FALSE,
  sent_via_sms BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (quote_id, version_number)
);

CREATE INDEX idx_quote_versions_quote_id ON quote_versions(quote_id);
CREATE INDEX idx_quote_versions_status ON quote_versions(status);
CREATE INDEX idx_quote_versions_approval_token ON quote_versions(approval_token);
```

#### 5. `line_items` (belong to a `quote_version`)
```sql
CREATE TABLE line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id UUID NOT NULL REFERENCES quote_versions(id) ON DELETE CASCADE,

  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,

  category VARCHAR(100),
  order_index INT,
  ai_suggested BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_line_items_quote_version_id ON line_items(quote_version_id);
```

#### 6. `customers`
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(2),
  postal_code VARCHAR(10),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_contractor_id ON customers(contractor_id);
CREATE INDEX idx_customers_email ON customers(email);
```

#### 7. `work_logs`
```sql
CREATE TABLE work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  
  file_name VARCHAR(255),
  file_size_bytes INT,
  file_type VARCHAR(10), -- 'pdf', 'csv', 'xlsx', 'txt'
  file_path TEXT,
  
  -- Extracted Data
  raw_text TEXT,
  extracted_data JSONB,
  processing_status VARCHAR(50), -- 'pending', 'processing', 'complete', 'failed'
  processing_error TEXT,
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_logs_contractor_id ON work_logs(contractor_id);
CREATE INDEX idx_work_logs_processing_status ON work_logs(processing_status);
```

#### 8. `quote_photos` (attach to draft `quote_version`; frozen when version is sent)
```sql
CREATE TABLE quote_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id UUID NOT NULL REFERENCES quote_versions(id) ON DELETE CASCADE,
  
  file_name VARCHAR(255),
  file_path TEXT,
  file_size_bytes INT,
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  order_index INT
);

CREATE INDEX idx_quote_photos_quote_version_id ON quote_photos(quote_version_id);
```

#### 9. `billing_events`
```sql
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  
  event_type VARCHAR(100), -- 'charge.succeeded', 'charge.failed', 'subscription.updated'
  stripe_event_id VARCHAR(255) UNIQUE,
  
  amount_cents INT,
  currency VARCHAR(3),
  
  description TEXT,
  raw_event JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_billing_events_contractor_id ON billing_events(contractor_id);
CREATE INDEX idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_created_at ON billing_events(created_at DESC);
```

#### 10. `audit_logs`
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
  
  action VARCHAR(100), -- 'quote_created', 'quote_sent', 'quote_approved', 'subscription_activated'
  resource_type VARCHAR(50), -- 'quote', 'contractor', 'subscription'
  resource_id VARCHAR(255),
  
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_contractor_id ON audit_logs(contractor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

#### 11. `email_logs`
```sql
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id UUID REFERENCES quote_versions(id) ON DELETE CASCADE,
  
  recipient_email VARCHAR(255),
  recipient_type VARCHAR(50), -- 'customer', 'contractor'
  
  email_type VARCHAR(100), -- 'quote_sent', 'approval_reminder', 'changes_requested'
  subject VARCHAR(255),
  status VARCHAR(50), -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  
  resend_message_id VARCHAR(255),
  error_message TEXT,
  
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_logs_quote_version_id ON email_logs(quote_version_id);
CREATE INDEX idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON email_logs(status);
```

### Database Relationships Diagram
```
auth.users (Supabase)
    ↓
contractors
    ├── quotes (base)
    │   └── quote_versions
    │       ├── line_items
    │       ├── quote_photos
    │       ├── email_logs
    │       └── approval_token (public client portal, SRS §4.4)
    ├── customers
    ├── work_logs
    ├── billing_events
    └── audit_logs
```

### Supabase Storage Buckets
```
tradeflo-ai/
├── work-logs/
│   └── {contractor_id}/{filename}
├── quote-photos/
│   └── {quote_version_id}/{filename}
└── quote-pdfs/
    └── {quote_version_id}/{quote_number}-v{version}.pdf
```

---

## API ROUTES & ENDPOINTS

### Authentication APIs

#### POST `/api/auth/signup`
**Purpose**: New contractor account creation  
**Public**: Yes (no auth required)  
**Body**:
```json
{
  "email": "contractor@example.com",
  "password": "securePassword123",
  "businessName": "Smith Roofing Ltd.",
  "ownerName": "John Smith",
  "phone": "506-123-4567"
}
```
**Response**:
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "..." },
  "session": { "access_token": "...", "refresh_token": "..." }
}
```
**Actions**:
- Create user in Supabase Auth
- Create contractor record
- Create initial Stripe customer
- Send welcome email (Email 1)
- Redirect to onboarding/welcome

---

#### POST `/api/auth/login`
**Purpose**: Contractor login  
**Public**: Yes  
**Body**:
```json
{
  "email": "contractor@example.com",
  "password": "password123"
}
```
**Response**:
```json
{
  "success": true,
  "session": { "access_token": "...", "refresh_token": "..." },
  "contractor": { "id": "...", "businessName": "..." }
}
```

---

#### POST `/api/auth/logout`
**Purpose**: End session  
**Protected**: Yes  
**Response**: `{ "success": true }`

---

#### POST `/api/auth/refresh`
**Purpose**: Refresh expired access token  
**Public**: Yes  
**Body**:
```json
{ "refreshToken": "..." }
```

---

#### POST `/api/auth/reset-password`
**Purpose**: Send password reset email  
**Public**: Yes  
**Body**:
```json
{ "email": "contractor@example.com" }
```

---

### Contractor/User APIs

#### GET `/api/user/profile`
**Purpose**: Get current user profile  
**Protected**: Yes  
**Response**:
```json
{
  "id": "uuid",
  "email": "contractor@example.com",
  "contractor": {
    "businessName": "Smith Roofing",
    "ownerName": "John Smith",
    "phone": "506-123-4567",
    "onboardingCompleted": false,
    "subscriptionStatus": "active",
    "quoteGenerationCount": 5,
    "workLogsUploaded": true
  }
}
```

---

#### PUT `/api/user/profile`
**Purpose**: Update user profile  
**Protected**: Yes  
**Body**: Same as response  
**Response**: Updated profile

---

#### GET `/api/contractor/settings`
**Purpose**: Get business settings  
**Protected**: Yes  
**Response**:
```json
{
  "businessName": "Smith Roofing Ltd.",
  "ownerName": "John Smith",
  "phone": "506-123-4567",
  "email": "business@smith.com",
  "city": "Halifax",
  "province": "NS",
  "tradeType": "Roofing",
  "hstNumber": "12345678",
  "logoUrl": null,
  "brandColor": "#000000"
}
```

---

#### PUT `/api/contractor/settings`
**Purpose**: Update business settings  
**Protected**: Yes  
**Body**: Same as response

---

### Onboarding APIs

#### POST `/api/onboarding/business`
**Purpose**: Save business details during onboarding  
**Protected**: Yes  
**Body**:
```json
{
  "businessName": "Smith Roofing Ltd.",
  "ownerName": "John Smith",
  "phone": "506-123-4567",
  "city": "Halifax",
  "province": "NS",
  "tradeType": "Roofing",
  "hstNumber": "12345678RT0001"
}
```
**Response**: `{ "success": true }`

---

#### POST `/api/onboarding/work-logs/upload`
**Purpose**: Upload work log file  
**Protected**: Yes  
**Content-Type**: multipart/form-data  
**Fields**:
- `file`: Binary file (PDF, CSV, XLSX, TXT - max 10MB)

**Response**:
```json
{
  "success": true,
  "workLog": {
    "id": "uuid",
    "fileName": "invoices.pdf",
    "fileSize": 2000000,
    "processingStatus": "pending"
  }
}
```
**Background Process**:
1. Upload file to Supabase Storage
2. Queue for async processing
3. Extract text based on file type
4. Store extracted data
5. Update contractor `work_logs_uploaded = true`

---

#### GET `/api/onboarding/status`
**Purpose**: Get current onboarding progress  
**Protected**: Yes  
**Response**:
```json
{
  "completed": false,
  "steps": {
    "welcome": { "completed": true },
    "business": { "completed": true },
    "workLogs": { "completed": false },
    "ready": { "completed": false }
  }
}
```

---

#### POST `/api/onboarding/complete`
**Purpose**: Mark onboarding complete  
**Protected**: Yes  
**Response**: `{ "success": true, "redirectTo": "<Netlify app path for first quote — see onboarding-flow.txt>" }`

---

### Quote APIs

#### POST `/api/quotes`
**Purpose**: Create new quote draft  
**Protected**: Yes  
**Body**:
```json
{
  "customerId": "uuid-or-null",
  "customerFirstName": "John",
  "customerLastName": "Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "506-123-4567",
  "jobType": "Exterior siding replacement",
  "jobDescription": "Replace damaged siding on 2-story home",
  "propertyType": "residential",
  "approxSqft": 2500,
  "siteAddress": "123 Main St, Halifax NS",
  "scopeNotes": "Standard access, surface in good condition"
}
```
**Response**:
```json
{
  "id": "uuid",
  "quoteNumber": "2026-001",
  "status": "draft",
  "createdAt": "2026-04-20T..."
}
```
**Actions**:
- Insert `quotes` row and first **`quote_versions`** row (`version_number = 1`, `status = 'draft'`) populated from the body
- `quote_number` unique per contractor

---

#### GET `/api/quotes`
**Purpose**: Get all contractor's quotes  
**Protected**: Yes  
**Query Params**:
- `status` (optional): draft, sent, approved, changes_requested
- `sortBy` (optional): date, status, customer
- `limit` (optional): default 50
- `offset` (optional): default 0

**Response**:
```json
{
  "quotes": [
    {
      "id": "uuid",
      "quoteNumber": "2026-001",
      "customerName": "John Doe",
      "totalPrice": 5500.00,
      "status": "draft",
      "createdAt": "2026-04-20T..."
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

---

#### GET `/api/quotes/[id]`
**Purpose**: Get single quote details  
**Protected**: Yes  
**Response**:
```json
{
  "id": "uuid",
  "quoteNumber": "2026-001",
  "status": "draft",
  "customerFirstName": "John",
  "customerLastName": "Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "506-123-4567",
  "jobType": "Exterior siding replacement",
  "jobDescription": "...",
  "propertyType": "residential",
  "approxSqft": 2500,
  "siteAddress": "123 Main St, Halifax NS",
  "scopeNotes": "...",
  "totalPrice": 5500.00,
  "taxAmount": 550.00,
  "taxPercentage": 15,
  "lineItems": [
    {
      "id": "uuid",
      "description": "Labour - siding removal and prep",
      "quantity": 40,
      "unitPrice": 85,
      "totalPrice": 3400,
      "category": "labour"
    },
    {
      "id": "uuid",
      "description": "James Hardie HardiePlank Siding",
      "quantity": 2000,
      "unitPrice": 0.82,
      "totalPrice": 1640,
      "category": "materials"
    }
  ],
  "photos": [
    {
      "id": "uuid",
      "url": "https://...",
      "uploadedAt": "2026-04-20T..."
    }
  ],
  "sentViaEmail": false,
  "sentViaSms": false,
  "validUntil": "2026-05-20T...",
  "createdAt": "2026-04-20T...",
  "updatedAt": "2026-04-20T..."
}
```

---

#### PUT `/api/quotes/[id]`
**Purpose**: Update **current draft** `quote_version` only  
**Protected**: Yes  
**Body**: Same fields as POST  
**Validation**: Target version `status = 'draft'`. **Never** mutate a row with `status = 'sent'` — clone to `version_number + 1` instead (SRS §4.2–4.3)

---

#### POST `/api/quotes/[id]/generate`
**Purpose**: Generate AI quote from job details  
**Protected**: Yes  
**Body**: (optional - can use existing quote data)
```json
{
  "regenerate": false
}
```

**Rate Limiting**: 20 calls/day per contractor

**Response**:
```json
{
  "success": true,
  "quote": {
    "id": "uuid",
    "totalPrice": 5500.00,
    "lineItems": [
      {
        "description": "Labour - siding removal and prep",
        "quantity": 40,
        "unitPrice": 85,
        "totalPrice": 3400,
        "category": "labour",
        "aiSuggested": true
      },
      {
        "description": "James Hardie HardiePlank Siding",
        "quantity": 2000,
        "unitPrice": 0.82,
        "totalPrice": 1640,
        "category": "materials",
        "aiSuggested": true
      }
    ],
    "generatedAt": "2026-04-20T..."
  },
  "generationsRemaining": 15
}
```

**Backend Process** (SRS §4.6 — **data flow only**; no guardrails or calibration tuning in this phase):
1. Check rate limit (20/day)
2. Load contractor work-log **extracted text** (if any) and attach **site photos** as **base64** per SRS inputs
3. Build prompt from **structured fields** only; call Anthropic **server-side**
4. Parse model output into line items (minimal parsing — output quality improvements are **out of scope**, SRS §5)
5. Calculate total + tax (HST for Canada)
6. Persist to **current draft** `quote_version` + `line_items`
7. Return to client

---

#### POST `/api/quotes/[id]/photos/upload`
**Purpose**: Add site photos to quote  
**Protected**: Yes  
**Content-Type**: multipart/form-data  
**Fields**:
- `photos`: Array of files (JPEG, PNG - max 5MB each)

**Response**:
```json
{
  "success": true,
  "photos": [
    {
      "id": "uuid",
      "url": "https://...",
      "uploadedAt": "2026-04-20T..."
    }
  ]
}
```

---

#### DELETE `/api/quotes/[id]/photos/[photoId]`
**Purpose**: Remove photo from quote  
**Protected**: Yes

---

#### POST `/api/quotes/[id]/send`
**Purpose**: Send quote to customer via email/SMS  
**Protected**: Yes  
**Body**:
```json
{
  "sendEmail": true,
  "sendSms": true,
  "personalNote": "Looking forward to discussing this with you."
}
```

**Response**:
```json
{
  "success": true,
  "status": "sent",
  "sentAt": "2026-04-20T...",
  "approvalLink": "https://tradeflo.app/client-portal/abc123def456",
  "emailSent": true,
  "smsSent": true
}
```

**Backend Process**:
1. Validate **draft** quote version is complete (line items, total, customer email)
2. Issue **`approval_token`** on this **quote_version**; optional `approval_token_expires_at`
3. Transition version to **`sent`** (immutable); persist `sent_at` (token **invalid after first customer action** — SRS §4.4)
4. Create approval URL
5. Send email via Resend API
6. Send SMS via Twilio API
7. Log email/SMS events (link to `quote_version_id`)
8. Set this **`quote_versions`** row to `status = 'sent'` (immutable from here)
9. Create audit log
10. Send contractor notification

---

#### GET `/api/quotes/[id]/pdf`
**Purpose**: Generate/download PDF of quote  
**Protected**: Yes  
**Query Params**:
- `download` (optional): true to force download, false to preview

**Response**: PDF binary file

**PDF Contents**:
- Contractor business details (name, phone, HST)
- Quote header (quote #, date, validity)
- Customer details
- Job description
- Line items (formatted table)
- Subtotal, Tax, Total
- Contractor signature line
- Terms & conditions

---

#### POST `/api/quotes/[id]/approve` (Client Portal)
**Purpose**: Customer approves quote  
**Public**: Yes (requires valid token)  
**URL**: `/api/public/quotes/[token]/approve`  
**Body**: (empty)

**Response**:
```json
{
  "success": true,
  "message": "Quote approved. Contractor notified."
}
```

**Backend Process**:
1. Resolve `quote_version` by token; reject if `approval_token_consumed_at` is set (**single use**, SRS §4.4)
2. Check token expiration if configured
3. Set version status to `approved`; set `approval_token_consumed_at` and `client_approved_at`
4. Notify contractor (email/SMS)

---

#### POST `/api/quotes/[id]/request-changes` (Client Portal)
**Purpose**: Customer requests quote changes  
**Public**: Yes  
**URL**: `/api/public/quotes/[token]/request-changes`  
**Body**:
```json
{
  "message": "Can you add a layer of insulation to the quote?"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Your feedback has been sent to the contractor."
}
```

**Backend Process**:
1. Same token rules as approve: **one customer action per token** — if you model “request changes” as that action, set `approval_token_consumed_at` after success (SRS §4.4); alternatively issue a new token only when contractor sends a **new version** (product choice — must satisfy “single action” semantics in SRS acceptance criteria)
2. Update version status to `changes_requested`; store message
3. Notify contractor

---

#### GET `/api/public/quotes/[token]` (Client Portal)
**Purpose**: Customer views quote (no login)  
**Public**: Yes  
**Response**: Quote details (same as `/api/quotes/[id]`)

---

### Work Log APIs

#### GET `/api/work-logs`
**Purpose**: List contractor's work logs  
**Protected**: Yes  
**Response**:
```json
{
  "workLogs": [
    {
      "id": "uuid",
      "fileName": "invoices.pdf",
      "fileSize": 2000000,
      "fileType": "pdf",
      "processingStatus": "complete",
      "uploadedAt": "2026-04-20T..."
    }
  ],
  "count": 3
}
```

---

#### DELETE `/api/work-logs/[id]`
**Purpose**: Delete work log file  
**Protected**: Yes  
**Response**: `{ "success": true }`

**Backend Process**:
1. Delete file from Supabase Storage
2. Delete work log record
3. Delete extracted data
4. Create audit log

---

### Billing/Stripe APIs

#### POST `/api/billing/checkout`
**Purpose**: Create Stripe Checkout session  
**Protected**: Yes  
**Body**: (empty - uses contractor's plan)

**Response**:
```json
{
  "sessionId": "cs_test_abc123",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

**Backend Process**:
1. Get contractor's Stripe customer ID
2. Create Stripe Checkout Session
3. Set success URL: `/dashboard`
4. Set cancel URL: `/dashboard/billing`
5. Return session ID to frontend (Stripe.js redirects)

---

#### GET `/api/billing/status`
**Purpose**: Get current subscription status  
**Protected**: Yes  
**Response**:
```json
{
  "status": "active",
  "plan": "$49/month",
  "currentPeriodStart": "2026-04-01T...",
  "currentPeriodEnd": "2026-05-01T...",
  "nextBillingDate": "2026-05-01T...",
  "cancelUrl": "https://billing.stripe.com/..."
}
```

---

#### POST `/api/billing/cancel`
**Purpose**: Cancel subscription  
**Protected**: Yes  
**Response**:
```json
{
  "success": true,
  "message": "Subscription cancelled. Your account and data will be retained for 90 days."
}
```

---

#### POST `/api/webhooks/stripe`
**Purpose**: Stripe webhook receiver  
**Public**: Yes (Stripe IP verification)  
**Headers**: `stripe-signature` (required)  
**Webhook Events Handled**:

```javascript
// charge.succeeded
- Update contractor.lastChargeAmount
- Update contractor.lastChargeDate
- Create billing_event record
- Log audit event

// charge.failed
- Update contractor.subscriptionStatus to 'past_due'
- Send contractor alert email
- Log billing_event

// customer.subscription.updated
- Update contractor.subscriptionStatus
- Update contractor.subscriptionEndAt
- Log billing_event

// customer.subscription.deleted
- Update contractor.subscriptionStatus to 'canceled'
- Schedule data purge (90 days)
- Log billing_event
```

---

### Analytics/Reporting APIs

#### GET `/api/analytics/quotes`
**Purpose**: Quote generation statistics  
**Protected**: Yes  
**Query Params**:
- `period`: 'day', 'week', 'month' (default: month)

**Response**:
```json
{
  "quotesGenerated": 15,
  "averageQuoteValue": 4250.00,
  "quotesApproved": 8,
  "approvalRate": 0.53,
  "topJobTypes": [
    { "jobType": "Roofing", "count": 5 },
    { "jobType": "Siding", "count": 3 }
  ]
}
```

---

### Health Check API

#### GET `/api/health`
**Purpose**: Uptime monitoring  
**Public**: Yes  
**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-20T...",
  "services": {
    "database": "ok",
    "supabase": "ok",
    "stripe": "ok",
    "anthropic": "ok"
  }
}
```

---

## AUTHENTICATION FLOW

### Sign Up Flow
```
1. User fills signup form
   ↓
2. Frontend: POST /api/auth/signup
   ↓
3. Backend:
   - Create auth.users record (Supabase Auth)
   - Create contractors record
   - Create Stripe customer
   - Send welcome email
   ↓
4. Return access token + refresh token
   ↓
5. Frontend: Store tokens in HTTP-only cookies
   ↓
6. Redirect to onboarding/welcome
```

### Login Flow
```
1. User enters email/password
   ↓
2. Frontend: POST /api/auth/login
   ↓
3. Backend:
   - Call Supabase Auth API
   - Return access token
   ↓
4. Frontend: Store in HTTP-only cookies
   ↓
5. Check onboarding status
   - If incomplete: redirect to onboarding
   - If complete: redirect to /dashboard
```

### Protected Route Flow
```
1. Frontend requests protected resource
   ↓
2. Next.js middleware.ts intercepts
   ↓
3. Validate access token from cookies
   ↓
4. If invalid: refresh using refresh token
   ↓
5. If refresh fails: redirect to login
   ↓
6. If valid: Continue to API route
```

### Token Management
```
Access Token:
- JWT from Supabase
- Short-lived (15 minutes)
- Stored in HTTP-only cookie
- Sent in Authorization header

Refresh Token:
- Long-lived (7 days)
- Stored in HTTP-only cookie
- Used to get new access token
- Auto-refresh before expiry

Client Portal Access (SRS §4.4):
- One approval_token per sent quote_version; validated server-side
- Single customer action per token; then set approval_token_consumed_at
- Optional approval_token_expires_at for abandoned links only
```

---

## INTEGRATION GUIDES

### 1. Supabase Setup

#### Initial Setup
```bash
# Install packages
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

# Create Supabase project at supabase.com
# Create tables from schema above
# Enable Row Level Security (RLS)
```

#### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
SUPABASE_JWT_SECRET=xxxxx
```

#### Create Client
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

#### Row Level Security (RLS) Policies
```sql
-- contractors table - users can only see their own record
CREATE POLICY "Users can view own contractor record"
ON contractors FOR SELECT
USING (user_id = auth.uid());

-- quotes — contractors see only their quote threads
CREATE POLICY "Contractors can view own quotes"
ON quotes FOR SELECT
USING (contractor_id = (
  SELECT id FROM contractors WHERE user_id = auth.uid()
));

-- quote_versions — inherit access via parent quote (SRS §4.3)
CREATE POLICY "Contractors can view own quote versions"
ON quote_versions FOR SELECT
USING (quote_id IN (
  SELECT id FROM quotes WHERE contractor_id = (
    SELECT id FROM contractors WHERE user_id = auth.uid()
  )
));

-- line_items — via quote_version
CREATE POLICY "Contractors can view own line items"
ON line_items FOR SELECT
USING (quote_version_id IN (
  SELECT qv.id FROM quote_versions qv
  JOIN quotes q ON q.id = qv.quote_id
  WHERE q.contractor_id = (SELECT id FROM contractors WHERE user_id = auth.uid())
));

-- work_logs table
CREATE POLICY "Contractors can view own work logs"
ON work_logs FOR SELECT
USING (contractor_id = (
  SELECT id FROM contractors WHERE user_id = auth.uid()
));
```

---

### 2. Stripe Integration

#### Setup
```bash
npm install stripe next-stripe

# Get API keys from Stripe Dashboard
# Enable webhooks to your app
```

#### Environment Variables
```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

#### Create Price in Stripe
```bash
# Use Stripe CLI or Dashboard
# Create $49 CAD / month price
# Save price ID in env variable
```

#### Webhook Handler
```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err}`, { status: 400 })
  }

  switch (event.type) {
    case 'charge.succeeded':
      await handleChargeSucceeded(event.data.object)
      break
    case 'charge.failed':
      await handleChargeFailed(event.data.object)
      break
    // ... more event types
  }

  return new Response('OK', { status: 200 })
}
```

---

### 3. Anthropic API Integration

**SRS §5 reminder:** This milestone implements **transport and structured input only**. Do **not** scope-creep into accuracy tuning, calibration UX, guardrails, or prompt optimization here.

#### Setup
```bash
npm install @anthropic-ai/sdk
```

#### Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-...
```

#### Create AI Service
```typescript
// services/ai.service.ts
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function generateQuote(input: {
  jobDescription: string
  tradeType: string
  propertyType: string
  workLogs: string[]
  photos?: Buffer[]
}) {
  const systemPrompt = `You are an AI assistant helping construction contractors generate accurate price quotes...`

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Generate a detailed quote for the following job: ${input.jobDescription}`
        },
        // Add images if provided
        ...(input.photos?.map(photo => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/jpeg" as const,
            data: photo.toString('base64')
          }
        })) || [])
      ]
    }
  ]

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages
  })

  return parseQuoteFromResponse(response)
}

function parseQuoteFromResponse(response) {
  // Parse Claude's response into structured line items
  // Return { lineItems, totalPrice }
}
```

---

### 4. Resend Email Integration

#### Setup
```bash
npm install resend
```

#### Environment Variables
```env
RESEND_API_KEY=re_...
```

#### Create Email Service
```typescript
// services/email.service.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendQuoteEmail(input: {
  toEmail: string
  customerName: string
  quoteNumber: string
  approvalLink: string
  quoteTotal: number
  contractorName: string
}) {
  const htmlContent = `
    <h1>Your Quote is Ready</h1>
    <p>Hi ${input.customerName},</p>
    <p>${input.contractorName} has prepared a quote for your project.</p>
    <p><strong>Quote #${input.quoteNumber}</strong></p>
    <p><strong>Total: $${input.quoteTotal.toLocaleString()}</strong></p>
    <a href="${input.approvalLink}">View & Approve Quote</a>
  `

  const { data, error } = await resend.emails.send({
    from: 'noreply@tradefloai.ca',
    to: input.toEmail,
    subject: `Quote #${input.quoteNumber} from ${input.contractorName}`,
    html: htmlContent
  })

  return { success: !error, messageId: data?.id }
}
```

---

### 5. Twilio SMS Integration

#### Setup
```bash
npm install twilio
```

#### Environment Variables
```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1...
```

#### Create SMS Service
```typescript
// services/sms.service.ts
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendQuoteSMS(input: {
  toPhone: string
  customerName: string
  quoteNumber: string
  approvalLink: string
}) {
  const message = `Hi ${input.customerName}, your quote #${input.quoteNumber} is ready to review: ${input.approvalLink}`

  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: input.toPhone
  })

  return { success: !!result.sid, messageSid: result.sid }
}
```

---

### 6. PDF Generation (PDFKit)

#### Setup
```bash
npm install pdfkit
```

#### Create PDF Service
```typescript
// services/pdf.service.ts
import PDFDocument from 'pdfkit'

export function generateQuotePDF(quote: any): Buffer {
  const doc = new PDFDocument()
  const chunks: Buffer[] = []

  doc.on('data', (chunk) => chunks.push(chunk))

  // Header
  doc.fontSize(20).text('QUOTE', 50, 50)
  doc.fontSize(12).text(`Quote #${quote.quoteNumber}`, 400, 50)

  // Contractor Info
  doc.fontSize(10).text(quote.contractorName, 50, 100)
  doc.text(quote.contractorPhone, 50, 115)
  doc.text(quote.contractorEmail, 50, 130)

  // Customer Info
  doc.fontSize(12).text('Bill To:', 50, 180)
  doc.fontSize(10)
  doc.text(`${quote.customerFirstName} ${quote.customerLastName}`, 50, 200)
  doc.text(quote.customerEmail, 50, 215)

  // Line Items
  doc.fontSize(12).text('Line Items', 50, 280)
  // ... draw table with line items

  // Total
  doc.fontSize(14).text(`Total: $${quote.totalPrice.toFixed(2)}`, 50, 600)

  doc.end()

  return Buffer.concat(chunks)
}
```

---

### 7. Rate Limiting

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Rate limit for quote generation
  if (request.nextUrl.pathname.includes('/api/quotes/') && 
      request.method === 'POST') {
    
    const userId = request.headers.get('x-user-id')
    const key = `quote-gen:${userId}`
    
    // Check Redis (Upstash) for rate limit
    const count = await getFromRedis(key)
    
    if (count >= 20) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. 20 quotes per day.' },
        { status: 429 }
      )
    }
    
    await incrementRedis(key)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*']
}
```

---

### 8. Error Logging (Sentry)

#### Setup
```bash
npm install @sentry/nextjs
```

#### Environment Variables
```env
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_ORG=your-org
SENTRY_PROJECT=tradeflo
```

#### Configure in next.config.js
```javascript
const { withSentryConfig } = require("@sentry/nextjs")

module.exports = withSentryConfig(
  {
    // your config
  },
  { org: "your-org", project: "tradeflo" }
)
```

#### Use in API routes
```typescript
import * as Sentry from "@sentry/nextjs"

export async function POST(request: Request) {
  try {
    // ... code
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        action: 'quote_generation',
        userId: 'uuid'
      },
      contexts: {
        quote: {
          quoteId: 'uuid',
          jobType: 'Roofing'
        }
      }
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## DEVELOPMENT PHASES

Phases map 1:1 to **SRS §6 milestones**. Calendar weeks are indicative only.

### Milestone 1 — Foundation, Auth & Core Quote Setup (SRS §6, M1)
**Deliverables**:
- Supabase project, schema (including `quotes` + `quote_versions`), RLS
- Auth APIs or documented Supabase client pattern; session persistence
- Quote create/read/update for **draft** versions only
- Input validation (Zod)

**Success criteria (SRS)**: Users can sign up, log in, and create/save quotes; no cross-tenant access.

---

### Milestone 2 — Workflows & AI Layer (SRS §6, M2)
**Deliverables**:
- Draft → **sent** transition; **immutable** sent versions; **new version** on edits after send
- Approval **token** issuance per **sent version**
- Onboarding **APIs** (business + work-log upload + parsing storage) — UI remains existing Netlify app (`docs/onboarding-flow.txt`)
- **Structured** AI payload → Anthropic; **20/day** rate limit
- Work-log text **automatically** included in AI input when present (SRS §4.5) — not “calibration” engineering in this phase (SRS §5)

**Success criteria (SRS)**: End-to-end quote generation with structured data flowing into AI.

---

### Milestone 3 — Integrations & Output (SRS §6, M3)
**Deliverables**:
- Stripe Checkout + webhooks; **7-day grace** then **read-only** (SRS §4.9)
- Resend + Twilio; delivery logging
- **Customer** approval / request-changes endpoints (**token** rules SRS §4.4)
- PDF export

**Success criteria (SRS)**: Quotes can be delivered, approved, billed, and exported.

---

### Milestone 4 — Finalization (SRS §6, M4)
**Deliverables**:
- Sentry + structured logs
- Error handling (AI, billing, delivery)
- **90-day** retention / purge after cancellation (SRS Milestone 4)
- Health check; audit logging
- QA / regression

**Success criteria (SRS)**: Production-ready core flows with observability.

**Deferred / out of scope (SRS §9)**: Admin dashboard, offline, advanced analytics, AI guardrails, accuracy/calibration product work, **PWA** (belongs to existing frontend if needed).

---

## SETUP INSTRUCTIONS

### Local Development Setup

#### 1. Clone and Install
```bash
# Clone the repository
git clone https://github.com/tradefloai/backend.git
cd backend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local
```

#### 2. Fill Environment Variables
```bash
# Edit .env.local with:
# - Supabase credentials
# - Stripe keys
# - Anthropic API key
# - Resend API key
# - Twilio credentials
# - Sentry DSN
```

#### 3. Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Create supabase project (or use existing)
# Update NEXT_PUBLIC_SUPABASE_URL and keys in .env.local

# Link to remote project
supabase link --project-ref xxxxx

# Push schema
supabase db push
```

#### 4. Run Development Server
```bash
npm run dev

# Server runs on http://localhost:3000
# API routes at http://localhost:3000/api
```

#### 5. Test Auth & Onboarding APIs
```bash
# 1. Run API locally: npm run dev
# 2. Use existing Netlify frontend (or Postman) against http://localhost:3000/api/...
# 3. Verify Supabase Auth user created
# 4. Exercise onboarding + work-log upload endpoints
# 5. Confirm RLS isolation with two test accounts
```

---

### Deployment to Netlify (SRS §3)

#### 1. Push to GitHub
```bash
git add .
git commit -m "Initial backend setup"
git push origin main
```

#### 2. Connect site on Netlify
Use Netlify’s **Next.js** runtime (or your org’s standard pattern) so `app/api` Route Handlers deploy as serverless/edge functions. Link the **backend** repo or monorepo root per project layout.

#### 3. Configure environment variables (Netlify UI)
```
Site settings → Environment variables

Add (same as .env.local):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_ID
- RESEND_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- NEXT_PUBLIC_SENTRY_DSN
```

#### 4. Configure webhook URLs
```
Stripe Dashboard:
- Webhooks → Add endpoint
- URL: https://<your-netlify-site>.netlify.app/api/webhooks/stripe
- Events: charge.succeeded, charge.failed, customer.subscription.updated, customer.subscription.deleted

Supabase:
- Settings → Webhooks (if needed)
```

#### 5. Deploy
```bash
git push origin main
# Netlify builds and deploys; confirm function logs for API routes
```

---

## DEPLOYMENT CHECKLIST

### Pre-Launch Checklist

#### Security
- [ ] All API keys in environment variables (not in code)
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (20 quotes/day)
- [ ] Password hashing verified (Supabase)
- [ ] JWT tokens validated on all protected routes
- [ ] SQL injection prevented (Supabase parameterized queries)
- [ ] CSRF protection enabled
- [ ] Sensitive data not logged

#### Database
- [ ] All tables created from schema
- [ ] RLS policies enabled
- [ ] Backups configured (daily)
- [ ] Indexes created for performance
- [ ] Foreign keys verified

#### Integrations
- [ ] Supabase project created & linked
- [ ] Stripe account configured (test & live keys)
- [ ] Anthropic API key working
- [ ] Resend API key working
- [ ] Twilio account configured
- [ ] Sentry project created

#### Testing
- [ ] Sign up → onboarding → quote generation flow tested end-to-end
- [ ] Quote send via email/SMS tested
- [ ] Client approval flow tested
- [ ] Stripe webhook tested (use Stripe CLI)
- [ ] Anthropic API called successfully
- [ ] Rate limiting tested
- [ ] Error handling tested (all failures logged)
- [ ] PDF generation tested

#### Performance
- [ ] Existing Netlify frontend meets agreed performance targets (if applicable)
- [ ] API response times < 2s (non-AI)
- [ ] Quote generation completes within agreed SLA (AI latency varies)
- [ ] File uploads ≤ SRS limits (e.g. 10MB work logs)
- [ ] Database queries optimized

#### Monitoring
- [ ] Sentry dashboard live
- [ ] Error alerts configured
- [ ] Billing events logged
- [ ] Health check endpoint working
- [ ] Uptime monitoring configured (Uptime Robot)

#### Compliance
- [ ] Privacy policy deployed
- [ ] PIPEDA requirements met
- [ ] Audit logs enabled
- [ ] Data retention policy set (90-day purge)
- [ ] Terms of service reviewed

#### Documentation
- [ ] README updated with setup instructions
- [ ] API documentation generated (Swagger/Postman)
- [ ] Database schema documented
- [ ] Deployment process documented
- [ ] Troubleshooting guide created

---

## ADDITIONAL NOTES

### Work Log Processing
When a contractor uploads work logs, they need to be processed to extract useful pricing data. This is resource-intensive, so use a background job queue:

```typescript
// services/work-log.service.ts
import { Queue } from 'bullmq'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)
const workLogQueue = new Queue('workLogs', { connection: redis })

// When file uploaded:
await workLogQueue.add({
  workLogId: 'uuid',
  filePath: 's3://...',
  fileType: 'pdf'
})

// Worker:
workLogQueue.process(async (job) => {
  const workLog = await getWorkLog(job.data.workLogId)
  
  // Extract text based on file type
  let text = ''
  if (job.data.fileType === 'pdf') {
    text = await extractPdfText(workLog.filePath)
  } else if (job.data.fileType === 'csv') {
    text = await readCsvFile(workLog.filePath)
  }
  
  // Store extracted text
  await updateWorkLog(job.data.workLogId, {
    rawText: text,
    processingStatus: 'complete'
  })
})
```

### Handling Stripe card failures (SRS §4.9)
Use a **7-day grace** period; after that, enforce **read-only** mode in middleware / API guards. During grace, full write access may remain per product policy.

```typescript
// On charge.failed webhook:
if (event.type === 'charge.failed') {
  const contractor = await getContractorByStripeId(event.customer)

  await updateContractor(contractor.id, {
    subscriptionStatus: 'past_due',
    billing_grace_period_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days — SRS §4.9
  })

  await sendCardFailedEmail(contractor)
}
// After gracePeriodEndsAt: set read-only flag; block mutating routes except billing update
```

### Rate Limit Reset
Reset daily quota at midnight contractor's timezone:

```typescript
// Every night:
const contractors = await getAllContractors()
for (const contractor of contractors) {
  const tz = contractor.timezone || 'Canada/Eastern'
  const nextReset = getNextMidnight(tz)
  
  await updateContractor(contractor.id, {
    quoteGenerationCount: 0,
    quoteGenerationResetAt: nextReset
  })
}
```

---

## TESTING STRATEGY

### Unit Tests
```bash
npm install --save-dev vitest

# Test services:
# - auth.service.ts
# - quote.service.ts
# - ai.service.ts
# - email.service.ts
# - pdf.service.ts
```

### Integration Tests
```bash
# Test full flows:
# 1. Sign up → Onboarding → First quote
# 2. Quote generation → Send → Customer approval
# 3. Stripe webhook → Subscription activated
# 4. Work log upload → extracted text included in next AI call
```

### E2E Tests
```bash
npm install --save-dev playwright

# Test in real browser:
# - Sign up flow
# - Quote builder
# - Email delivery (mock Resend)
# - Client approval page
```

---

## ESTIMATED TIMELINE

Schedule is indicative; **scope is defined by SRS §6 milestones**, not by week labels.

| SRS milestone | Theme | Indicative effort |
|---------------|--------|-------------------|
| M1 | Auth, schema, draft quotes | Week 1 |
| M2 | Versioning, send lock, AI data flow, onboarding APIs | Week 1–2 |
| M3 | Stripe (7-day grace + read-only), email/SMS, client portal, PDF | Week 2–3 |
| M4 | Sentry, retention, QA | Week 3–4 |

---

## CONTACT & SUPPORT

**Technical Advisor**: Available for architecture questions (SRS §5–6 alignment)  
**Zane (Product Owner)**:  
- Email: zane@tradefloai.ca  
- Phone: 506-259-0537

---

*This document expands **`docs/srs.txt`** into implementation guidance. If in doubt, **SRS acceptance criteria win**.*
