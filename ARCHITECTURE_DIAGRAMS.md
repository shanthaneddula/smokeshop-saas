# 🏗️ Platform Architecture Visual Guide

**Understanding the SaaS Platform Structure**

---

## 🎭 The Two Worlds: Platform vs Tenant

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR SAAS PLATFORM                           │
│                   (smokeshop-saas.com)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
        ┌───────────▼─────────┐   ┌─────▼──────────────┐
        │  PLATFORM ADMIN      │   │  TENANT INSTANCES  │
        │  (You & Your Team)   │   │  (Your Customers)  │
        └──────────────────────┘   └────────────────────┘
                │                           │
    ┌───────────┴────────────┐      ┌──────┴──────────────┐
    │                        │      │                     │
    │ /platform/dashboard    │      │ joessmokeshop.com   │
    │ /platform/tenants      │      │ mikesvapes.com      │
    │ /platform/billing      │      │ austinsmoke.com     │
    │ /platform/analytics    │      │ ...                 │
    │                        │      │                     │
    │ Manage ALL tenants     │      │ Each has own:       │
    │ Track revenue          │      │ - Products          │
    │ Handle billing         │      │ - Orders            │
    │ System monitoring      │      │ - Customers         │
    └────────────────────────┘      │ - POS system        │
                                    └─────────────────────┘
```

---

## 🗄️ Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────────┐
│   MASTER DATABASE        │     │   TENANT DATABASES           │
│   (PostgreSQL)           │     │   (PostgreSQL - Per Tenant)  │
├──────────────────────────┤     ├──────────────────────────────┤
│ • tenants (registry)     │────▶│ Tenant 1: Joe's Smoke Shop   │
│ • admin_users            │     │  • users                     │
│ • subscription_plans     │     │  • orders                    │
│ • tenant_activity_logs   │     │  • customers                 │
│ • invoices               │     │  • pos_transactions          │
│ • migrations_log         │     │  • pos_sessions              │
└──────────────────────────┘     │                              │
                                 │ Tenant 2: Mike's Vapes       │
                                 │  • users                     │
                                 │  • orders                    │
       ▲                         │  • customers                 │
       │                         │  • ...                       │
       │                         │                              │
       │                         │ Tenant 3: Austin Smoke       │
       │                         │  • ...                       │
       │                         └──────────────────────────────┘
       │
       │                         ┌──────────────────────────────┐
       │                         │   MONGODB (Product Catalog)  │
       │                         ├──────────────────────────────┤
       └─────────────────────────│ Master Catalog:              │
                                 │  • master_products           │
                                 │  • master_brands             │
                                 │  • master_categories         │
                                 │                              │
                                 │ Tenant Databases:            │
                                 │  • tenant-joes-smoke-shop    │
                                 │    - products (inventory)    │
                                 │  • tenant-mikes-vapes        │
                                 │    - products (inventory)    │
                                 │  • ...                       │
                                 └──────────────────────────────┘
```

**Key Principle**: 
- **Master DB** = Platform data (who are the tenants, what plans, billing info)
- **Tenant DBs** = Operational data (orders, customers, POS transactions)
- **MongoDB** = Product data (specifications, images, pricing)

---

## 🔄 Tenant Creation Flow

```
┌────────────────────────────────────────────────────────────────┐
│ AUTOMATED TENANT PROVISIONING (What You're Building Week 1-2) │
└────────────────────────────────────────────────────────────────┘

Step 1: Platform Admin Clicks "Create Tenant"
   │
   ▼
Step 2: Fill Out Wizard
   ├─ Business Name: "Joe's Smoke Shop"
   ├─ Subdomain: "joes"
   ├─ Plan: "Pro ($149/mo)"
   └─ Owner: "Joe Smith (joe@example.com)"
   │
   ▼
Step 3: Click "Create" → API Call
   │
   ▼
┌──────────────────────────────────────┐
│ BACKEND AUTOMATION (5-10 seconds)   │
├──────────────────────────────────────┤
│ 1. Create tenant record in Master DB │
│    └─ Status: "trial"                │
│    └─ Trial ends: +14 days           │
│                                      │
│ 2. Create Supabase Project           │
│    └─ Project name: "joes-smoke"     │
│    └─ Wait for provisioning...       │
│    └─ Get connection string          │
│                                      │
│ 3. Run Database Migrations           │
│    └─ Create tables (users, orders,  │
│       customers, pos_transactions)   │
│                                      │
│ 4. Create MongoDB Database           │
│    └─ Database: "tenant-joes-smoke"  │
│    └─ Collection: "products"         │
│    └─ Create indexes                 │
│                                      │
│ 5. Create Initial Admin User         │
│    └─ Email: joe@example.com         │
│    └─ Password: Temp123!             │
│    └─ Role: "owner"                  │
│                                      │
│ 6. Create Stripe Customer            │
│    └─ Start 14-day trial             │
│    └─ No credit card required        │
│                                      │
│ 7. Send Welcome Email                │
│    └─ Login URL                      │
│    └─ Temporary password             │
│    └─ Getting started guide          │
│                                      │
│ 8. Log Activity                      │
│    └─ "Tenant created by admin@..."  │
└──────────────────────────────────────┘
   │
   ▼
✅ Tenant Ready!
   │
   ▼
Joe receives email:
"Welcome to Smoke Shop SaaS!
Your shop is ready at: https://joes.yourdomain.com
Login: joe@example.com
Password: Temp123! (change on first login)"
```

---

## 💳 Billing Flow (Stripe Integration)

```
┌─────────────────────────────────────────────────────────────┐
│ SUBSCRIPTION LIFECYCLE (What You're Building Week 3-4)     │
└─────────────────────────────────────────────────────────────┘

Day 0: Tenant Created
   │
   ├─ Status: "trial"
   ├─ Stripe Customer: Created
   ├─ Trial Ends: Day 14
   └─ Credit Card: Not required
   │
   ▼
Day 7: Trial Reminder Email
   │
   └─ "7 days left in your trial. Add payment method to continue."
   │
   ▼
Day 13: Final Reminder Email
   │
   └─ "1 day left! Add payment method now."
   │
   ▼
Day 14: Trial Ends
   │
   ├─ Has payment method?
   │  ├─ YES → Charge $149
   │  │        └─ Success?
   │  │           ├─ YES → Status: "active"
   │  │           │        Send receipt email
   │  │           │
   │  │           └─ NO → Retry in 3 days
   │  │                  Send payment failed email
   │  │
   │  └─ NO → Status: "suspended"
   │           Send trial ended email
   │           "Add payment to reactivate"
   │
   ▼
Ongoing: Monthly Billing
   │
   ├─ Stripe charges card automatically
   │  └─ Webhook → Update invoice record
   │
   └─ Payment failed?
          ├─ Day 1: Retry charge
          ├─ Day 3: Retry charge (grace period)
          ├─ Day 5: Suspend tenant
          └─ Send "Please update payment method" emails

┌─────────────────────────────────────────┐
│ UPGRADE/DOWNGRADE FLOW                  │
├─────────────────────────────────────────┤
│ Tenant clicks "Upgrade to Pro"          │
│   │                                     │
│   ├─ Current: Basic ($49/mo)            │
│   ├─ New: Pro ($149/mo)                 │
│   │                                     │
│   ├─ Calculate proration:               │
│   │   Used 10 days of Basic = $16.33   │
│   │   Remaining 20 days of Pro = $99.33│
│   │   Charge today: $83 difference      │
│   │                                     │
│   ├─ Update Stripe subscription         │
│   ├─ Update tenant plan in DB           │
│   ├─ Enable Pro features                │
│   └─ Send confirmation email            │
│                                         │
│ Future charges: $149/mo                 │
└─────────────────────────────────────────┘
```

---

## 📊 Analytics Calculation

```
┌──────────────────────────────────────────────────────────┐
│ METRICS DASHBOARD (What You're Building Week 7-8)       │
└──────────────────────────────────────────────────────────┘

Monthly Recurring Revenue (MRR):
┌─────────────────────────────────┐
│ Basic Plan    ($49)  × 12 = $588  │
│ Pro Plan      ($149) × 8  = $1,192│
│ Enterprise    ($499) × 4  = $1,996│
│                                   │
│ Total MRR = $3,776                │
└─────────────────────────────────┘

Annual Recurring Revenue (ARR):
└─ MRR × 12 = $45,312

Average Revenue Per User (ARPU):
└─ $3,776 / 24 tenants = $157.33

Churn Rate (Last Month):
┌─────────────────────────────────┐
│ Started with: 26 tenants          │
│ Lost: 2 tenants (cancelled)       │
│ Churn = (2/26) × 100 = 7.7%      │
└─────────────────────────────────┘

Trial Conversion Rate:
┌─────────────────────────────────┐
│ Trials started: 20                │
│ Converted to paid: 13             │
│ Conversion = (13/20) × 100 = 65% │
└─────────────────────────────────┘

Growth Rate:
┌─────────────────────────────────┐
│ Last Month MRR: $3,200            │
│ This Month MRR: $3,776            │
│ Growth = ($576/$3,200) × 100     │
│        = 18% month-over-month    │
└─────────────────────────────────┘
```

---

## 🔐 Authentication & Authorization

```
┌──────────────────────────────────────────────────────────┐
│ TWO SEPARATE AUTH SYSTEMS (Already Built)               │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────┐   ┌─────────────────────────────┐
│ PLATFORM ADMIN AUTH     │   │ TENANT USER AUTH            │
├─────────────────────────┤   ├─────────────────────────────┤
│ URL: /platform/login    │   │ URL: /login (on tenant      │
│                         │   │       domain)               │
│ Database:               │   │                             │
│  Master DB              │   │ Database:                   │
│  admin_users table      │   │  Tenant DB                  │
│                         │   │  users table                │
│ Cookie:                 │   │                             │
│  platform-auth-token    │   │ Cookie:                     │
│                         │   │  auth-token                 │
│ Payload:                │   │                             │
│  { adminId, role,       │   │ Payload:                    │
│    issuer: 'platform' } │   │  { userId, tenantId, role } │
│                         │   │                             │
│ Permissions:            │   │ Permissions:                │
│  - View all tenants     │   │  - Manage own products      │
│  - Create tenants       │   │  - Process orders           │
│  - Suspend tenants      │   │  - View own reports         │
│  - Access billing       │   │  - Cannot access platform   │
│  - View analytics       │   │    admin                    │
│  - Impersonate tenants  │   │                             │
└─────────────────────────┘   └─────────────────────────────┘
```

---

## 🎯 Feature Flags & Limits

```
┌──────────────────────────────────────────────────────────┐
│ PLAN-BASED FEATURE ENFORCEMENT                           │
└──────────────────────────────────────────────────────────┘

BASIC PLAN ($49/mo):
├─ Max Users: 2
├─ Max Products: 500
├─ Max Locations: 1
├─ Features:
│  ✅ Basic POS
│  ❌ Advanced Reporting
│  ❌ API Access
│  ❌ Multi-location
└─ Enforcement:
   └─ Middleware checks before action
      if (productCount >= plan.maxProducts) {
        return "Upgrade to add more products"
      }

PRO PLAN ($149/mo):
├─ Max Users: 10
├─ Max Products: 5,000
├─ Max Locations: 5
├─ Features:
│  ✅ Advanced POS
│  ✅ Advanced Reporting
│  ✅ API Access
│  ✅ Multi-location
│  ❌ White-label
└─ Enforcement: Same as above

ENTERPRISE ($499/mo):
├─ Max Users: Unlimited
├─ Max Products: Unlimited
├─ Max Locations: Unlimited
├─ Features:
│  ✅ Everything in Pro
│  ✅ White-label branding
│  ✅ Priority support
│  ✅ Custom integrations
│  ✅ Dedicated account manager
└─ Enforcement: No limits
```

---

## 🚀 Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│ PRODUCTION DEPLOYMENT (Vercel + Supabase + MongoDB)     │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐
│ Vercel (Frontend + API Routes)  │
│ yourplatform.com                 │
├─────────────────────────────────┤
│ • Next.js App                    │
│ • Serverless Functions           │
│ • Edge Middleware                │
│ • Static Assets (images via Blob)│
└─────────────────────────────────┘
          │
          ├────────────────┐
          │                │
          ▼                ▼
┌─────────────────┐  ┌──────────────────────┐
│ Supabase        │  │ MongoDB Atlas        │
│ (PostgreSQL)    │  │ (Product Catalog)    │
├─────────────────┤  ├──────────────────────┤
│ Master DB       │  │ • Master products    │
│  • Tenants      │  │ • Tenant products    │
│  • Admins       │  │   (per-tenant DBs)   │
│  • Plans        │  │                      │
│                 │  └──────────────────────┘
│ Tenant DBs      │
│  • joe's DB     │
│  • mike's DB    │
│  • ...          │
└─────────────────┘

          ▼
┌─────────────────────────────────┐
│ External Services               │
├─────────────────────────────────┤
│ • Stripe (billing)              │
│ • Resend (email)                │
│ • Twilio (SMS)                  │
│ • Vercel Blob (image storage)   │
└─────────────────────────────────┘
```

---

## 🎬 Summary

**Key Concepts:**
1. **Platform Admin** = You managing all customers
2. **Tenants** = Your customers (smoke shop owners)
3. **Master DB** = Registry of all tenants + billing
4. **Tenant DBs** = Each customer's operational data (isolated)
5. **Automation** = Tenant creation, billing, migrations (no manual work)

**What You're Building:**
- **Dashboard** to see all tenants at a glance
- **Onboarding wizard** to create tenants automatically
- **Billing system** that charges customers monthly
- **Analytics** to track your business (MRR, churn, growth)
- **Management tools** to suspend/activate/upgrade tenants

**End Result:**
- 100% self-service platform
- Scales to 1000+ customers
- Automated billing & provisioning
- Clear visibility into business health

Start with **Week 1** guide and build piece by piece! 🚀
