# 🚀 Week 3 Implementation Guide - Billing, Analytics & Monitoring

**Goal**: Build billing/subscription system, analytics dashboard, system health monitoring, and audit trails  
**Time**: 7 days (Days 15-21)  
**Difficulty**: Advanced

---

## 📅 Day-by-Day Breakdown

### **Day 15: Stripe Integration Setup**

#### Task 15.1: Environment & Stripe Account Setup
**Prerequisites**:
- Create Stripe account (test mode)
- Get API keys: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Install Stripe SDK: `npm install stripe @stripe/stripe-js`

**Environment Variables** (`.env.local`):
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

#### Task 15.2: Create Subscription Plans in Stripe
**Manual Setup in Stripe Dashboard**:
1. Create Products: "Basic Plan", "Pro Plan", "Enterprise Plan"
2. Create Prices for each product (monthly/annual)
3. Copy Price IDs to environment variables

#### Task 15.3: Initialize Stripe Client
**File**: `src/lib/stripe/client.ts`
- Export server-side Stripe instance
- Export client-side loadStripe function
- Add error handling for missing API keys

#### Task 15.4: Create Subscription Schema Updates
**File**: `prisma/schema-master.prisma`
- Add `stripeCustomerId` to `Tenant` model
- Add `stripeSubscriptionId` to `Tenant` model
- Add `subscriptionStatus` enum (active, trialing, past_due, canceled)
- Add `currentPeriodEnd` DateTime field
- Run migration: `npx prisma migrate dev --name add_stripe_fields --schema=prisma/schema-master.prisma`

---

### **Day 16: Subscription Management APIs**

#### Task 16.1: Create Stripe Customer on Tenant Creation
**File**: `src/lib/stripe/customer.ts`
**Functions**:
- `createStripeCustomer(tenant, ownerEmail)` - Creates Stripe customer, returns customerId
- `updateStripeCustomer(customerId, updates)` - Updates customer metadata
- `deleteStripeCustomer(customerId)` - Archives customer in Stripe

**Update**: `src/app/api/platform/tenants/create/route.ts`
- After tenant creation, call `createStripeCustomer()`
- Store `stripeCustomerId` in tenant record
- Handle errors gracefully (tenant should still be created)

#### Task 16.2: Subscription Creation API
**File**: `src/app/api/platform/billing/create-subscription/route.ts`
**Method**: POST
**Body**: `{ tenantId, priceId, paymentMethodId? }`
**Logic**:
1. Verify platform admin authentication
2. Get tenant from master DB
3. Create Stripe subscription with customer ID
4. Set trial period if applicable (14 days)
5. Update tenant record with subscription details
6. Return subscription object

#### Task 16.3: Subscription Update API
**File**: `src/app/api/platform/billing/update-subscription/route.ts`
**Method**: PATCH
**Body**: `{ tenantId, newPriceId }`
**Logic**:
1. Get current subscription from Stripe
2. Update subscription to new price (prorate charges)
3. Update tenant record
4. Return updated subscription

#### Task 16.4: Cancel Subscription API
**File**: `src/app/api/platform/billing/cancel-subscription/route.ts`
**Method**: POST
**Body**: `{ tenantId, immediate: boolean }`
**Logic**:
- If immediate: cancel now, suspend tenant
- If not immediate: cancel at period end
- Update tenant status accordingly

---

### **Day 17: Stripe Webhooks & Payment Flow**

#### Task 17.1: Webhook Endpoint
**File**: `src/app/api/webhooks/stripe/route.ts`
**Method**: POST
**Important**: Disable body parsing, verify signature

**Events to Handle**:
- `customer.subscription.created` - Update tenant subscription status
- `customer.subscription.updated` - Update subscription details
- `customer.subscription.deleted` - Suspend tenant, mark subscription canceled
- `invoice.payment_succeeded` - Log successful payment, extend period
- `invoice.payment_failed` - Mark tenant as past_due, send notification
- `customer.subscription.trial_will_end` - Send reminder email (3 days before)

#### Task 17.2: Payment Status Monitoring
**File**: `src/lib/stripe/subscription-status.ts`
**Functions**:
- `syncSubscriptionStatus(tenantId)` - Fetch from Stripe, update DB
- `checkPaymentStatus(tenantId)` - Returns current payment status
- `handleFailedPayment(tenantId)` - Suspend tenant, notify owner

#### Task 17.3: Tenant Billing Dashboard (Platform Admin View)
**File**: `src/app/platform/billing/page.tsx`
**Features**:
- Table of all tenants with subscription status
- Filter by status (active, past_due, trialing, canceled)
- Quick actions: view in Stripe, cancel, upgrade/downgrade
- Revenue metrics: MRR, total active subscriptions

---

### **Day 18: Analytics Dashboard - Part 1 (Data Collection)**

#### Task 18.1: Analytics Schema
**File**: `prisma/schema-master.prisma`
**New Models**:

**DailyMetrics**:
- `id`, `tenantId`, `date`
- `totalOrders`, `totalRevenue`, `averageOrderValue`
- `newCustomers`, `returningCustomers`
- `posTransactions`, `onlineOrders`
- `productsSold`, `topSellingProductId`

**TenantActivityLog**:
- `id`, `tenantId`, `userId`, `action`, `entity`, `entityId`
- `changes` (JSONB), `ipAddress`, `userAgent`
- `timestamp`, `status` (success/failed)

**SystemHealthMetric**:
- `id`, `timestamp`, `metricType`, `value`
- `tenantId?` (null for platform-wide metrics)
- `metadata` (JSONB)

Run migration after adding schemas.

#### Task 18.2: Metrics Collection Service
**File**: `src/lib/analytics/metrics-collector.ts`
**Functions**:
- `recordDailyMetrics(tenantId, date)` - Aggregate daily stats from tenant DB
- `recordActivityLog(tenantId, action, details)` - Log user actions
- `recordSystemHealth(metricType, value)` - Log system metrics

#### Task 18.3: Background Job for Daily Metrics
**File**: `src/app/api/cron/daily-metrics/route.ts`
**Method**: GET (protected by cron secret)
**Logic**:
1. Get all active tenants
2. For each tenant, calculate yesterday's metrics
3. Store in DailyMetrics table
4. Handle errors per tenant (don't fail entire job)

**Vercel Cron Config** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/daily-metrics",
    "schedule": "0 1 * * *"
  }]
}
```

#### Task 18.4: Activity Logging Middleware
**File**: `src/lib/analytics/activity-logger.ts`
**Purpose**: Automatically log all API calls to tenant databases
**Hook into**:
- User authentication (login/logout)
- CRUD operations (create/update/delete orders, products, customers)
- POS transactions
- Settings changes

---

### **Day 19: Analytics Dashboard - Part 2 (Visualization)**

#### Task 19.1: Install Chart Libraries
```bash
npm install recharts date-fns
npm install @tremor/react  # Optional: pre-built dashboard components
```

#### Task 19.2: Platform-Wide Analytics Page
**File**: `src/app/platform/analytics/page.tsx`
**Sections**:
1. **KPI Cards** (top row):
   - Total Active Tenants
   - Monthly Recurring Revenue (MRR)
   - Total Transactions Today
   - System Uptime %

2. **Revenue Chart** (line chart):
   - Last 30 days revenue
   - Compare current vs previous period
   - Breakdown by plan type

3. **Tenant Growth Chart** (area chart):
   - New tenants over time
   - Cumulative total

4. **Top Performing Tenants** (table):
   - Ranked by transaction volume
   - Revenue, order count, customer count

#### Task 19.3: Single Tenant Analytics API
**File**: `src/app/api/platform/analytics/tenant/[tenantId]/route.ts`
**Method**: GET
**Query Params**: `?startDate=...&endDate=...`
**Returns**:
```json
{
  "summary": {
    "totalRevenue": 45230.50,
    "totalOrders": 342,
    "averageOrderValue": 132.25,
    "newCustomers": 28,
    "returningCustomers": 143
  },
  "dailyMetrics": [...],
  "topProducts": [...],
  "revenueByCategory": {...}
}
```

#### Task 19.4: Tenant-Specific Analytics Page
**File**: `src/app/platform/tenants/[tenantId]/analytics/page.tsx`
**Charts**:
- Revenue Trend (last 90 days)
- Orders by Type (pickup vs delivery)
- Customer Retention Rate
- Product Performance (top 10 products)
- Peak Hours Heatmap (when most transactions occur)

---

### **Day 20: System Health Monitoring**

#### Task 20.1: Health Check Endpoints
**File**: `src/app/api/health/route.ts`
**Method**: GET
**Returns**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-08T10:30:00Z",
  "services": {
    "database": { "status": "up", "latency": 12 },
    "redis": { "status": "up", "latency": 3 },
    "mongodb": { "status": "up", "latency": 8 }
  },
  "version": "1.0.0"
}
```

**File**: `src/app/api/health/detailed/route.ts` (platform admin only)
**Returns**:
- Active database connections count
- Memory usage
- API response times (p50, p95, p99)
- Error rates last hour
- Queue depths

#### Task 20.2: Database Status Monitoring
**File**: `src/lib/monitoring/database-health.ts`
**Functions**:
- `checkMasterDbHealth()` - Test query + connection pool stats
- `checkTenantDbHealth(tenantId)` - Test query on specific tenant DB
- `checkMongoDbHealth()` - Test MongoDB connection
- `getConnectionPoolStats()` - Return active/idle connections

#### Task 20.3: API Performance Tracking
**File**: `src/lib/monitoring/api-tracker.ts`
**Middleware**: Track all API requests
**Metrics to Collect**:
- Request path, method, status code
- Response time (ms)
- User agent, IP address
- Tenant ID (if applicable)

**Storage**: Use Redis for real-time metrics, PostgreSQL for historical

#### Task 20.4: System Health Dashboard
**File**: `src/app/platform/monitoring/page.tsx`
**Sections**:
1. **Service Status** (cards with green/red indicators):
   - Master Database
   - MongoDB
   - Redis Cache
   - Background Jobs

2. **API Performance** (charts):
   - Requests per minute (last hour)
   - Average response time
   - Error rate %
   - Slowest endpoints (table)

3. **Database Stats** (metrics):
   - Connection pool usage
   - Query performance
   - Slow queries (> 1 second)
   - Database size

4. **Alerts** (list):
   - High error rate warnings
   - Database connection warnings
   - Failed webhook deliveries

---

### **Day 21: Tenant Activity Logs & Audit Trail**

#### Task 21.1: Activity Logger Service
**File**: `src/lib/audit/activity-logger.ts`
**Function**: `logActivity(params)`
**Parameters**:
```typescript
{
  tenantId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  entity: 'order' | 'product' | 'customer' | 'user' | 'setting';
  entityId: string;
  changes?: { before: any, after: any };
  ipAddress: string;
  userAgent: string;
}
```

#### Task 21.2: Automatic Activity Tracking
**Implementation Locations**:
- `src/app/api/auth/login/route.ts` - Log login attempts
- `src/app/api/auth/logout/route.ts` - Log logout
- All POST/PATCH/DELETE endpoints - Log CRUD operations

**Pattern**:
```typescript
// After successful operation
await logActivity({
  tenantId: tenant.id,
  userId: user.id,
  action: 'CREATE',
  entity: 'order',
  entityId: newOrder.id,
  changes: { after: newOrder },
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
});
```

#### Task 21.3: Activity Log Viewer (Platform Admin)
**File**: `src/app/platform/tenants/[tenantId]/activity/page.tsx`
**Features**:
- Table of all activities (paginated)
- Filters:
  - Date range
  - User
  - Action type (CREATE/UPDATE/DELETE)
  - Entity type
- Search by entity ID
- Export to CSV
- View changes diff (before/after comparison)

#### Task 21.4: Activity Log API
**File**: `src/app/api/platform/activity-logs/route.ts`
**Method**: GET
**Query Params**:
- `tenantId` (required)
- `userId` (optional)
- `action` (optional)
- `entity` (optional)
- `startDate`, `endDate` (optional)
- `page`, `limit` (pagination)

**Returns**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "timestamp": "2026-01-08T14:23:10Z",
      "user": { "id": "uuid", "name": "John Doe" },
      "action": "UPDATE",
      "entity": "product",
      "entityId": "prod-123",
      "changes": {
        "before": { "price": 29.99 },
        "after": { "price": 24.99 }
      },
      "ipAddress": "192.168.1.1"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

#### Task 21.5: Real-Time Activity Feed
**File**: `src/components/platform/ActivityFeed.tsx`
**Features**:
- Live updates (poll every 10 seconds or use WebSocket)
- Show last 20 activities across all tenants
- Color-coded by action type
- Click to view details
- Filter by tenant

#### Task 21.6: Compliance & Data Retention
**File**: `src/app/api/cron/cleanup-old-logs/route.ts`
**Purpose**: Delete activity logs older than retention period
**Logic**:
- Delete logs older than 90 days (configurable)
- Keep deletion logs permanently
- Run daily at midnight

---

## 🛠️ Additional Implementation Details

### Stripe Webhook Testing
**Local Development**:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger customer.subscription.created
```

### Analytics Data Accuracy
**Best Practices**:
1. Use database transactions for metrics updates
2. Implement idempotency (don't double-count metrics)
3. Run daily reconciliation job (compare calculated vs stored metrics)
4. Log discrepancies for investigation

### Monitoring Alerts
**Set Up Notifications** (choose one):
- Email alerts for critical issues
- Slack webhook integration
- PagerDuty for on-call
- Discord webhook for dev team

**Trigger Conditions**:
- Error rate > 5% in last 10 minutes
- API response time > 2 seconds (p95)
- Database connection failures
- Failed payments (immediate notification)

### Performance Optimization
**Analytics Queries**:
- Add database indexes on `tenantId`, `date`, `timestamp`
- Use materialized views for complex aggregations
- Cache frequently accessed metrics (Redis, 5-minute TTL)

**Activity Logs**:
- Batch insert logs (don't block API responses)
- Use queue (Redis Bull) for async processing
- Partition table by month for better query performance

---

## ✅ Week 3 Checklist

### Billing (Days 15-16)
- [ ] Stripe account setup (test mode)
- [ ] Create subscription plans in Stripe dashboard
- [ ] Install Stripe SDK and configure environment
- [ ] Add Stripe fields to tenant schema (migration)
- [ ] Create Stripe customer on tenant creation
- [ ] Subscription creation API
- [ ] Subscription update API
- [ ] Cancel subscription API
- [ ] Webhook endpoint for subscription events
- [ ] Payment failure handling

### Analytics (Days 18-19)
- [ ] Analytics schema (DailyMetrics, ActivityLog)
- [ ] Metrics collection service
- [ ] Daily metrics cron job
- [ ] Activity logging middleware
- [ ] Platform-wide analytics dashboard
- [ ] Tenant-specific analytics API
- [ ] Tenant-specific analytics page
- [ ] Revenue charts (Recharts)
- [ ] Top products/tenants reports

### Monitoring (Day 20)
- [ ] Health check endpoint (basic)
- [ ] Detailed health check (platform admin)
- [ ] Database health monitoring
- [ ] API performance tracking
- [ ] System health dashboard
- [ ] Connection pool stats
- [ ] Alert system setup
- [ ] Slow query detection

### Audit Trail (Day 21)
- [ ] Activity logger service
- [ ] Automatic CRUD tracking
- [ ] Login/logout logging
- [ ] Activity log viewer UI
- [ ] Activity log API with filters
- [ ] Changes diff viewer
- [ ] Real-time activity feed
- [ ] Log retention cleanup cron

---

## 🧪 Testing Checklist

### Stripe Integration Tests
```bash
# Test subscription creation
node scripts/test-stripe-subscription.js

# Test webhook events
stripe trigger customer.subscription.updated
```

### Analytics Tests
- [ ] Verify daily metrics cron runs successfully
- [ ] Check metrics accuracy (manual calculation vs stored)
- [ ] Test date range filters
- [ ] Verify charts render correctly
- [ ] Test export functionality

### Monitoring Tests
- [ ] Call `/api/health` - should return 200
- [ ] Simulate high load - check metrics
- [ ] Stop Redis - verify alert triggers
- [ ] Check slow query detection

### Activity Log Tests
- [ ] Create order - verify log entry
- [ ] Update product - check before/after diff
- [ ] Filter logs by user
- [ ] Export logs to CSV
- [ ] Verify log cleanup cron

---

## 📊 Database Migrations Summary

**Migration 1**: Add Stripe fields to tenants
```bash
npx prisma migrate dev --name add_stripe_to_tenants --schema=prisma/schema-master.prisma
```

**Migration 2**: Add analytics tables
```bash
npx prisma migrate dev --name add_analytics_tables --schema=prisma/schema-master.prisma
```

**Migration 3**: Add activity logs
```bash
npx prisma migrate dev --name add_activity_logs --schema=prisma/schema-master.prisma
```

---

## 🚀 Week 4 Preview

Next week (Days 22-28), you'll build:
1. **Email Notification System** (SendGrid/Resend)
2. **Webhook Management** (tenant webhooks for integrations)
3. **Backup & Restore** (automated database backups)
4. **Multi-Factor Authentication** (2FA for platform admin)
5. **API Rate Limiting** (per-tenant quotas)

---

## 💡 Pro Tips

1. **Stripe Test Cards**: Use `4242 4242 4242 4242` for successful payments
2. **Webhook Debugging**: Always log raw webhook payloads for troubleshooting
3. **Analytics Caching**: Cache dashboard data for 5 minutes to reduce DB load
4. **Activity Logs**: Don't log sensitive data (passwords, tokens)
5. **Monitoring**: Start simple, add complexity as needed
6. **Performance**: Index all foreign keys and timestamp fields
7. **Compliance**: Activity logs are critical for SOC 2, GDPR compliance
8. **Billing Edge Cases**: Test trial expiration, failed renewals, dunning

---

## 🔐 Security Considerations

1. **Stripe Webhook Signature**: Always verify signatures to prevent spoofing
2. **Activity Logs**: Sanitize user input before logging (prevent XSS in logs)
3. **Health Endpoints**: Protect detailed health check with admin auth
4. **Analytics**: Never expose tenant data to other tenants
5. **Monitoring**: Redact sensitive data in error logs (API keys, passwords)

---

## 📈 Success Metrics

By end of Week 3, you should have:
- ✅ Automated billing with Stripe (subscriptions, webhooks)
- ✅ Real-time analytics dashboard showing MRR, revenue trends
- ✅ System health monitoring with alerts
- ✅ Complete audit trail for compliance
- ✅ 90%+ test coverage on critical billing paths
- ✅ Sub-2-second page load times on analytics dashboards

Good luck with Week 3! 🎉
