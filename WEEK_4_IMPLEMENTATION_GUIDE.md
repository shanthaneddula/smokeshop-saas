# 🚀 Week 4 Implementation Guide - Notifications, Webhooks, Backups & Security

**Goal**: Build email system, webhook infrastructure, automated backups, 2FA, and rate limiting  
**Time**: 7 days (Days 22-28)  
**Difficulty**: Advanced

---

## 📅 Day-by-Day Breakdown

### **Day 22: Email Notification System - Part 1 (Setup)**

#### Task 22.1: Choose Email Provider & Setup
**Options**:
- **Resend** (recommended for modern apps, great DX)
- **SendGrid** (enterprise-grade, established)
- **AWS SES** (cost-effective for high volume)
- **Postmark** (transactional email specialist)

**Setup Steps**:
1. Create account with chosen provider
2. Verify domain (add DNS records)
3. Get API key
4. Add to environment: `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`

#### Task 22.2: Email Service Infrastructure
**File**: `src/lib/email/client.ts`
**Purpose**: Initialize email client, handle API errors

**File**: `src/lib/email/templates.ts`
**Template Functions**:
- `welcomeEmail(tenantName, ownerName, loginUrl)` - New tenant welcome
- `subscriptionConfirmation(planName, amount, nextBillingDate)`
- `paymentFailed(tenantName, amount, retryDate)`
- `trialEndingReminder(daysRemaining, upgradeUrl)`
- `invoiceReceipt(invoiceId, amount, pdfUrl)`
- `passwordResetEmail(resetToken, expiresIn)`
- `lowInventoryAlert(productName, currentStock, threshold)`
- `dailySalesSummary(metrics)`

#### Task 22.3: Email Template Schema
**File**: `prisma/schema-master.prisma`
**New Model**: `EmailLog`
- `id`, `tenantId?`, `recipientEmail`, `subject`, `templateName`
- `status` (sent, failed, bounced, opened)
- `sentAt`, `openedAt`, `clickedAt`
- `errorMessage?`, `metadata` (JSONB)
- `provider` (resend, sendgrid, etc.)

Run migration: `npx prisma migrate dev --name add_email_logs`

#### Task 22.4: Email Queue System
**File**: `src/lib/email/queue.ts`
**Purpose**: Queue emails for async sending (prevents API blocking)

**Implementation Options**:
1. **Redis Bull Queue** (recommended for production)
2. **Database Queue** (simpler, good for MVP)
3. **Vercel Queue** (if using Vercel platform)

**Functions**:
- `queueEmail(to, subject, template, data)` - Add to queue
- `processEmailQueue()` - Worker to send emails
- `retryFailedEmails()` - Retry logic with exponential backoff

---

### **Day 23: Email Notification System - Part 2 (Implementation)**

#### Task 23.1: Email Sending API
**File**: `src/app/api/email/send/route.ts`
**Method**: POST
**Body**: `{ to, subject, templateName, data, tenantId? }`
**Security**: Platform admin or tenant user only
**Logic**:
1. Validate recipient email
2. Load template and render with data
3. Queue email for sending
4. Log to EmailLog table
5. Return immediate response (don't wait for actual send)

#### Task 23.2: Email Webhook Handler (for tracking)
**File**: `src/app/api/webhooks/email/route.ts`
**Purpose**: Receive delivery/open/click events from email provider
**Events to Handle**:
- `email.delivered` - Update status to delivered
- `email.opened` - Record openedAt timestamp
- `email.clicked` - Record clickedAt timestamp
- `email.bounced` - Mark as bounced, disable future emails
- `email.complained` - Mark as spam complaint

#### Task 23.3: Integrate Emails with Existing Flows
**Update These Files**:
- `src/app/api/platform/tenants/create/route.ts` - Send welcome email
- `src/app/api/webhooks/stripe/route.ts` - Send payment emails
- `src/app/api/auth/forgot-password/route.ts` - Send reset email
- Background cron jobs - Send daily summaries, alerts

#### Task 23.4: Email Management Dashboard
**File**: `src/app/platform/emails/page.tsx`
**Features**:
- Table of all sent emails (last 30 days)
- Filter by status, tenant, template
- Search by recipient
- View email content (preview)
- Resend failed emails
- Email analytics: open rate, click rate, bounce rate

---

### **Day 24: Webhook Management System**

#### Task 24.1: Tenant Webhook Schema
**File**: `prisma/schema-master.prisma`
**New Model**: `TenantWebhook`
- `id`, `tenantId`, `url`, `secret`, `events[]` (array of event types)
- `status` (active, paused, disabled)
- `createdAt`, `lastTriggeredAt`, `failureCount`
- `metadata` (JSONB - custom headers, etc.)

**New Model**: `WebhookDelivery`
- `id`, `webhookId`, `eventType`, `payload` (JSONB)
- `status` (pending, sent, failed), `responseCode?`, `responseBody?`
- `attemptCount`, `sentAt`, `nextRetryAt`

Run migration: `npx prisma migrate dev --name add_tenant_webhooks`

#### Task 24.2: Webhook Events System
**File**: `src/lib/webhooks/events.ts`
**Event Types**:
- `order.created`, `order.updated`, `order.completed`
- `product.created`, `product.updated`, `product.deleted`
- `customer.created`, `customer.updated`
- `inventory.low_stock`, `inventory.out_of_stock`
- `pos.transaction_completed`
- `subscription.updated`, `subscription.canceled`

**Function**: `emitWebhookEvent(tenantId, eventType, payload)`
**Logic**:
1. Find all active webhooks for tenant subscribed to this event
2. Queue delivery for each webhook
3. Return immediately (async delivery)

#### Task 24.3: Webhook Delivery Worker
**File**: `src/lib/webhooks/delivery.ts`
**Function**: `deliverWebhook(webhookDeliveryId)`
**Logic**:
1. Get webhook delivery record
2. Sign payload with HMAC-SHA256 (using webhook secret)
3. Send POST request to webhook URL
4. Record response (status, body, timing)
5. Update delivery status
6. Retry logic: 3 attempts with exponential backoff (1min, 10min, 1hr)
7. Disable webhook after 10 consecutive failures

#### Task 24.4: Webhook Management APIs
**File**: `src/app/api/platform/tenants/[tenantId]/webhooks/route.ts`
**Methods**:
- **GET**: List all webhooks for tenant
- **POST**: Create new webhook (validate URL, generate secret)

**File**: `src/app/api/platform/tenants/[tenantId]/webhooks/[webhookId]/route.ts`
**Methods**:
- **GET**: Get webhook details
- **PATCH**: Update webhook (URL, events, status)
- **DELETE**: Delete webhook

**File**: `src/app/api/platform/tenants/[tenantId]/webhooks/[webhookId]/test/route.ts`
**Method**: POST
**Purpose**: Send test webhook to verify URL

#### Task 24.5: Webhook Dashboard
**File**: `src/app/platform/tenants/[tenantId]/webhooks/page.tsx`
**Features**:
- List of configured webhooks
- Create new webhook form
- Edit/delete actions
- View delivery history (last 100 deliveries)
- Retry failed deliveries
- Webhook testing tool
- Example payloads documentation

---

### **Day 25: Automated Backup & Restore System**

#### Task 25.1: Backup Schema
**File**: `prisma/schema-master.prisma`
**New Model**: `DatabaseBackup`
- `id`, `tenantId?`, `type` (full, incremental)
- `status` (in_progress, completed, failed)
- `size` (bytes), `location` (S3 URL or file path)
- `startedAt`, `completedAt`, `expiresAt`
- `metadata` (JSONB - row counts, checksums)

Run migration: `npx prisma migrate dev --name add_database_backups`

#### Task 25.2: Backup Service Setup
**Storage Options**:
1. **AWS S3** (recommended, cheap and reliable)
2. **Supabase Storage** (if using Supabase)
3. **Local filesystem** (development only)

**Environment Variables**:
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=smokeshop-backups
AWS_REGION=us-east-1
BACKUP_RETENTION_DAYS=30
```

#### Task 25.3: Backup Creation Service
**File**: `src/lib/backups/create-backup.ts`
**Function**: `createTenantBackup(tenantId, type)`
**Logic**:
1. Get tenant database connection
2. Create backup record (status: in_progress)
3. Use `pg_dump` to export PostgreSQL database
4. Export MongoDB collections to JSON
5. Compress backup files (gzip)
6. Upload to S3 with encryption
7. Calculate checksums for integrity
8. Update backup record (status: completed, size, location)
9. Send notification to platform admins

**Commands Used**:
- PostgreSQL: `pg_dump -Fc -Z9 <db_url> -f backup.dump`
- MongoDB: `mongodump --uri <mongo_uri> --gzip --archive=backup.gz`

#### Task 25.4: Automated Backup Cron Job
**File**: `src/app/api/cron/daily-backups/route.ts`
**Method**: GET (protected by cron secret)
**Schedule**: Daily at 2 AM (low traffic period)
**Logic**:
1. Get all active tenants
2. For each tenant:
   - Check if backup needed (last backup > 24 hours ago)
   - Create full backup
   - Delete backups older than retention period
3. Create master database backup
4. Send summary report to admins

**Vercel Cron Config** (update `vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-backups",
      "schedule": "0 2 * * *"
    }
  ]
}
```

#### Task 25.5: Restore Service
**File**: `src/lib/backups/restore-backup.ts`
**Function**: `restoreTenantBackup(backupId, tenantId)`
**Logic**:
1. Download backup from S3
2. Verify checksum
3. Create temporary database
4. Restore backup to temp database
5. Verify data integrity
6. If successful, swap with production (requires downtime)
7. If failed, rollback
8. Log restore operation

**Important**: This is a dangerous operation - require additional confirmation

#### Task 25.6: Backup Management UI
**File**: `src/app/platform/backups/page.tsx`
**Features**:
- List of all backups (all tenants)
- Filter by tenant, date, status
- Create manual backup button
- Download backup (with authentication)
- Restore backup (with confirmation modal)
- Backup schedule configuration
- Storage usage metrics

---

### **Day 26: Multi-Factor Authentication (2FA)**

#### Task 26.1: 2FA Schema
**File**: `prisma/schema-master.prisma`
**Update Model**: `PlatformAdmin`
- Add `twoFactorEnabled` Boolean (default false)
- Add `twoFactorSecret` String? (encrypted)
- Add `twoFactorBackupCodes` String[] (hashed)
- Add `lastTwoFactorVerifiedAt` DateTime?

**New Model**: `TwoFactorVerificationAttempt`
- `id`, `adminId`, `success` Boolean, `ipAddress`, `timestamp`

Run migration: `npx prisma migrate dev --name add_2fa_to_admin`

#### Task 26.2: Install 2FA Libraries
```bash
npm install speakeasy qrcode
npm install @types/speakeasy @types/qrcode --save-dev
```

**Libraries**:
- `speakeasy` - Generate TOTP secrets and verify codes
- `qrcode` - Generate QR codes for authenticator apps

#### Task 26.3: 2FA Setup APIs
**File**: `src/app/api/platform/auth/2fa/setup/route.ts`
**Method**: POST
**Purpose**: Generate secret and QR code for 2FA setup
**Returns**:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,...",
  "backupCodes": ["12345678", "87654321", ...]
}
```

**File**: `src/app/api/platform/auth/2fa/verify-setup/route.ts`
**Method**: POST
**Body**: `{ token, secret }`
**Purpose**: Verify TOTP token and enable 2FA
**Logic**:
1. Verify token matches secret
2. Encrypt and save secret to admin record
3. Generate 10 backup codes (hash and store)
4. Enable 2FA flag
5. Return backup codes (user should save these)

#### Task 26.4: 2FA Login Flow
**File**: `src/app/api/platform/auth/login/route.ts`
**Update Existing Logic**:
1. Verify email + password (existing)
2. If 2FA enabled for user:
   - Return `{ requiresTwoFactor: true, tempToken: '...' }`
   - Don't set full auth session yet
3. If 2FA not enabled:
   - Set auth session (existing flow)

**File**: `src/app/api/platform/auth/2fa/verify-login/route.ts`
**Method**: POST
**Body**: `{ tempToken, token }`
**Purpose**: Verify TOTP during login
**Logic**:
1. Validate tempToken (short-lived, 5 minutes)
2. Get admin from tempToken
3. Verify TOTP token or backup code
4. If valid, create full auth session
5. Log verification attempt
6. Return auth token

#### Task 26.5: 2FA Management APIs
**File**: `src/app/api/platform/auth/2fa/disable/route.ts`
**Method**: POST
**Body**: `{ password, token }`
**Purpose**: Disable 2FA (require password + current TOTP)

**File**: `src/app/api/platform/auth/2fa/regenerate-backup-codes/route.ts`
**Method**: POST
**Body**: `{ password }`
**Purpose**: Generate new backup codes (invalidate old ones)

#### Task 26.6: 2FA UI Components
**File**: `src/app/platform/login/page.tsx`
**Update**: Add 2FA token input step after password

**File**: `src/app/platform/settings/security/page.tsx`
**Features**:
- Enable 2FA button → Shows QR code modal
- Disable 2FA button (requires password + token)
- Regenerate backup codes button
- View trusted devices (future enhancement)
- 2FA status indicator

---

### **Day 27: API Rate Limiting System**

#### Task 27.1: Rate Limit Schema
**File**: `prisma/schema-master.prisma`
**New Model**: `RateLimitRule`
- `id`, `tenantId?`, `ruleType` (global, per-tenant, per-ip)
- `endpoint` (pattern, e.g., `/api/products/*`)
- `maxRequests`, `windowSeconds`
- `enabled`, `createdAt`, `updatedAt`

**New Model**: `RateLimitViolation`
- `id`, `tenantId?`, `ipAddress`, `endpoint`
- `requestCount`, `timestamp`, `blocked` Boolean

Run migration: `npx prisma migrate dev --name add_rate_limiting`

#### Task 27.2: Redis Rate Limiter
**File**: `src/lib/rate-limiting/redis-limiter.ts`
**Purpose**: Use Redis for fast rate limit checks

**Algorithms**:
1. **Token Bucket** (recommended) - Allows bursts
2. **Fixed Window** - Simple but has edge case issues
3. **Sliding Window** - Most accurate but more complex

**Function**: `checkRateLimit(key, maxRequests, windowSeconds)`
**Returns**: `{ allowed: boolean, remaining: number, resetAt: timestamp }`

**Redis Keys**:
- `ratelimit:tenant:{tenantId}:{endpoint}` - Per-tenant limits
- `ratelimit:ip:{ipAddress}` - Global IP limits
- `ratelimit:api:{apiKey}` - API key limits (future)

#### Task 27.3: Rate Limiting Middleware
**File**: `src/lib/rate-limiting/middleware.ts`
**Purpose**: Apply rate limits to all API requests

**Default Limits**:
- **Platform Admin**: 1000 requests/hour
- **Tenant Basic Plan**: 500 requests/hour
- **Tenant Pro Plan**: 2000 requests/hour
- **Tenant Enterprise**: 10000 requests/hour
- **Anonymous/Public**: 100 requests/hour per IP

**Headers Added to Response**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**429 Response**:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 3600,
  "limit": 500,
  "remaining": 0
}
```

#### Task 27.4: Rate Limit Management APIs
**File**: `src/app/api/platform/rate-limits/route.ts`
**Method**: GET - List all rate limit rules
**Method**: POST - Create custom rate limit rule

**File**: `src/app/api/platform/rate-limits/[ruleId]/route.ts`
**Method**: GET - Get rule details
**Method**: PATCH - Update rule
**Method**: DELETE - Delete rule

**File**: `src/app/api/platform/rate-limits/violations/route.ts`
**Method**: GET - List recent violations
**Query Params**: `?tenantId=...&startDate=...&endDate=...`

#### Task 27.5: Rate Limit Dashboard
**File**: `src/app/platform/rate-limits/page.tsx`
**Features**:
- Current rate limit rules (table)
- Create/edit rule form
- Recent violations (last 24 hours)
- Chart: API usage over time by tenant
- Top rate-limited IPs
- Quick actions: temporarily increase limit, block IP

#### Task 27.6: Tenant-Facing Rate Limit Info
**File**: `src/app/api/tenant/rate-limit-status/route.ts`
**Method**: GET
**Purpose**: Allow tenant to check their current rate limit usage
**Returns**:
```json
{
  "plan": "pro",
  "limit": 2000,
  "used": 456,
  "remaining": 1544,
  "resetAt": "2026-01-08T15:00:00Z",
  "percentUsed": 22.8
}
```

**File**: `src/app/dashboard/settings/api/page.tsx` (tenant dashboard)
**Features**:
- Current plan rate limits
- Usage meter (visual)
- Request history (last 7 days)
- Upgrade prompt if near limit

---

### **Day 28: Testing, Documentation & Optimization**

#### Task 28.1: Integration Testing Suite
**File**: `tests/week4-integration.test.ts`
**Test Cases**:

**Email Tests**:
- Send welcome email successfully
- Queue email and process worker
- Handle email provider failures
- Track email opens/clicks
- Retry failed emails

**Webhook Tests**:
- Create tenant webhook
- Trigger webhook on order creation
- Verify HMAC signature
- Handle webhook delivery failures
- Retry logic works correctly
- Disable webhook after repeated failures

**Backup Tests**:
- Create full backup successfully
- Backup includes all data
- Restore backup to new database
- Verify data integrity after restore
- Cleanup old backups

**2FA Tests**:
- Setup 2FA generates valid secret
- QR code scans correctly
- Verify TOTP token works
- Backup codes work for login
- Cannot login without 2FA when enabled
- Disable 2FA successfully

**Rate Limiting Tests**:
- Block requests after limit exceeded
- Reset counter after window expires
- Different limits per tenant plan
- Rate limit headers present
- 429 response format correct

#### Task 28.2: Performance Optimization
**Email Queue**:
- Batch email sends (send 10 at a time)
- Add indexes on `EmailLog.sentAt`, `EmailLog.status`
- Archive old email logs (>90 days) to cold storage

**Webhook Delivery**:
- Use connection pooling for webhook HTTP requests
- Timeout webhooks after 10 seconds
- Add indexes on `WebhookDelivery.status`, `WebhookDelivery.nextRetryAt`
- Limit webhook payload size to 1MB

**Backups**:
- Compress backups before upload (gzip level 9)
- Use S3 lifecycle policies (move to Glacier after 30 days)
- Stream large backups (don't load entire file in memory)

**Rate Limiting**:
- Use Redis pipelining for bulk checks
- Cache rate limit rules in memory (5-minute TTL)
- Add TTL to Redis keys (auto cleanup)

#### Task 28.3: Monitoring & Alerts
**Add Monitoring For**:
- Email delivery success rate (alert if < 95%)
- Webhook delivery success rate (alert if < 90%)
- Backup failures (alert immediately)
- Rate limit violations (alert if > 100/hour)
- 2FA bypass attempts (security alert)

**Dashboard Widgets**:
- Emails sent today (count)
- Failed webhook deliveries (last hour)
- Last successful backup timestamp
- Rate limit violations (last 24 hours)

#### Task 28.4: Security Audit
**Checklist**:
- [ ] Email webhook signatures verified
- [ ] Tenant webhook HMAC signatures implemented
- [ ] Backup files encrypted at rest (S3 encryption)
- [ ] 2FA secrets encrypted in database
- [ ] Backup codes hashed (bcrypt)
- [ ] Rate limit bypass protection
- [ ] No sensitive data in email logs
- [ ] Webhook URLs validated (no localhost, no internal IPs)
- [ ] Backup restore requires super admin confirmation
- [ ] 2FA backup codes shown only once

#### Task 28.5: Documentation
**Create Documentation Files**:

**File**: `docs/EMAIL_SYSTEM.md`
- Email provider setup
- Available templates
- How to add new templates
- Tracking metrics
- Troubleshooting

**File**: `docs/WEBHOOK_SYSTEM.md`
- Available webhook events
- Payload schemas for each event
- HMAC signature verification
- Testing webhooks locally
- Common integration patterns

**File**: `docs/BACKUP_RESTORE.md`
- Backup schedule
- Manual backup creation
- Restore procedures
- Data retention policy
- Disaster recovery plan

**File**: `docs/TWO_FACTOR_AUTH.md`
- Enabling 2FA
- Backup codes usage
- Troubleshooting (lost device)
- Recovery process

**File**: `docs/RATE_LIMITING.md`
- Rate limit tiers
- Custom rate limits
- Handling 429 errors
- Best practices

#### Task 28.6: Final Testing & Bug Fixes
**Manual Testing Checklist**:
- [ ] Send all email types, verify they arrive
- [ ] Create webhook, trigger events, check delivery
- [ ] Create backup, download, verify contents
- [ ] Setup 2FA, login with it, disable it
- [ ] Hit rate limit, verify 429 response
- [ ] Test all error scenarios
- [ ] Check all dashboard pages load
- [ ] Verify mobile responsiveness

**Load Testing**:
- Send 1000 emails in queue, verify all deliver
- Trigger 100 webhooks simultaneously
- Create backup during high traffic
- Hit rate limit from multiple IPs

---

## ✅ Week 4 Checklist

### Email System (Days 22-23)
- [ ] Email provider account setup
- [ ] Email templates created (8+ templates)
- [ ] Email queue system implemented
- [ ] Email sending API
- [ ] Email webhook handler (tracking)
- [ ] Email logs schema and migration
- [ ] Integration with existing flows
- [ ] Email management dashboard
- [ ] Email analytics (open/click rates)

### Webhook System (Day 24)
- [ ] Tenant webhook schema (migration)
- [ ] Webhook delivery schema
- [ ] Webhook event types defined
- [ ] Webhook delivery worker
- [ ] HMAC signature generation
- [ ] Retry logic with exponential backoff
- [ ] Webhook management APIs
- [ ] Webhook dashboard
- [ ] Webhook testing tool
- [ ] Auto-disable after failures

### Backup System (Day 25)
- [ ] Backup schema (migration)
- [ ] S3 bucket setup
- [ ] PostgreSQL backup script
- [ ] MongoDB backup script
- [ ] Backup compression
- [ ] S3 upload with encryption
- [ ] Daily backup cron job
- [ ] Backup retention cleanup
- [ ] Restore functionality
- [ ] Backup management UI

### 2FA System (Day 26)
- [ ] 2FA schema updates (migration)
- [ ] TOTP library installed
- [ ] 2FA setup API (QR code generation)
- [ ] 2FA verification API
- [ ] Backup codes generation
- [ ] Updated login flow
- [ ] 2FA management APIs
- [ ] 2FA UI components
- [ ] Security settings page

### Rate Limiting (Day 27)
- [ ] Rate limit schema (migration)
- [ ] Redis rate limiter implementation
- [ ] Rate limiting middleware
- [ ] Per-tenant rate limits
- [ ] Per-IP rate limits
- [ ] Rate limit management APIs
- [ ] Rate limit dashboard
- [ ] Tenant-facing usage stats
- [ ] 429 response format
- [ ] Rate limit headers

### Testing & Documentation (Day 28)
- [ ] Integration test suite
- [ ] Performance optimizations
- [ ] Monitoring alerts setup
- [ ] Security audit completed
- [ ] Documentation files created
- [ ] Manual testing completed
- [ ] Load testing completed
- [ ] Bug fixes deployed

---

## 🧪 Testing Checklist

### Email System Tests
```bash
# Send test email
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","templateName":"welcome",...}'

# Check email logs
node scripts/check-email-logs.js
```

### Webhook System Tests
```bash
# Create webhook
curl -X POST http://localhost:3000/api/platform/tenants/TENANT_ID/webhooks \
  -d '{"url":"https://webhook.site/...","events":["order.created"]}'

# Trigger test webhook
curl -X POST http://localhost:3000/api/platform/tenants/TENANT_ID/webhooks/WEBHOOK_ID/test
```

### Backup System Tests
```bash
# Create manual backup
node scripts/create-backup.js TENANT_ID

# Verify backup contents
aws s3 cp s3://smokeshop-backups/backup-123.tar.gz - | tar -tzf -

# Test restore (CAUTION: use test tenant)
node scripts/restore-backup.js BACKUP_ID TENANT_ID
```

### 2FA Tests
- [ ] Setup 2FA in Google Authenticator
- [ ] Login with 2FA token
- [ ] Use backup code for login
- [ ] Disable 2FA
- [ ] Regenerate backup codes

### Rate Limiting Tests
```bash
# Hit rate limit
for i in {1..600}; do curl http://localhost:3000/api/products; done

# Check rate limit violations
curl http://localhost:3000/api/platform/rate-limits/violations
```

---

## 📊 Database Migrations Summary

**Migration 1**: Email logs
```bash
npx prisma migrate dev --name add_email_logs --schema=prisma/schema-master.prisma
```

**Migration 2**: Tenant webhooks
```bash
npx prisma migrate dev --name add_tenant_webhooks --schema=prisma/schema-master.prisma
```

**Migration 3**: Database backups
```bash
npx prisma migrate dev --name add_database_backups --schema=prisma/schema-master.prisma
```

**Migration 4**: 2FA for admin
```bash
npx prisma migrate dev --name add_2fa_to_admin --schema=prisma/schema-master.prisma
```

**Migration 5**: Rate limiting
```bash
npx prisma migrate dev --name add_rate_limiting --schema=prisma/schema-master.prisma
```

---

## 🚀 Week 5 Preview

Next week (Days 29-35), you'll build:
1. **Advanced Search & Filtering** (Elasticsearch integration)
2. **Custom Reports Generator** (PDF/Excel exports)
3. **Tenant White-Labeling** (custom branding)
4. **Mobile App API** (REST API for mobile POS)
5. **Inventory Predictions** (ML-based stock forecasting)
6. **Multi-Location Support** (franchise management)
7. **API Documentation** (Swagger/OpenAPI)

---

## 💡 Pro Tips

1. **Email Deliverability**: Warm up your domain gradually (start with low volume)
2. **Webhook Timeouts**: Always set timeout to prevent hanging workers
3. **Backup Testing**: Test restore monthly to ensure backups work
4. **2FA Recovery**: Always provide support channel for lost 2FA device
5. **Rate Limiting**: Start conservative, increase based on actual usage
6. **Email Templates**: Use a template engine (Handlebars/React Email)
7. **Webhook Retries**: Cap at 3 attempts to avoid infinite loops
8. **Backup Encryption**: Always encrypt backups containing customer data
9. **2FA UX**: Show QR code + manual entry code (for apps that don't scan)
10. **Rate Limits**: Whitelist monitoring tools from rate limits

---

## 🔐 Security Considerations

1. **Email Security**:
   - Use SPF, DKIM, DMARC records
   - Never send passwords in emails
   - Rate limit forgot password requests
   - Sanitize user data in templates (XSS prevention)

2. **Webhook Security**:
   - Always verify HMAC signatures
   - Validate webhook URLs (block internal IPs)
   - Timeout requests after 10 seconds
   - Don't send sensitive data in webhooks (use IDs + fetch)

3. **Backup Security**:
   - Encrypt backups at rest (S3 server-side encryption)
   - Restrict S3 bucket access (IAM policies)
   - Require MFA for restore operations
   - Audit log all backup/restore actions

4. **2FA Security**:
   - Encrypt TOTP secrets in database
   - Hash backup codes (bcrypt)
   - Rate limit 2FA verification attempts
   - Invalidate backup codes after use
   - Force 2FA for platform admins

5. **Rate Limiting Security**:
   - Rate limit authentication endpoints aggressively
   - Block IPs with suspicious patterns
   - Different limits for authenticated vs anonymous
   - Monitor for distributed attacks

---

## 📈 Success Metrics

By end of Week 4, you should have:
- ✅ 95%+ email delivery rate
- ✅ Automated daily backups for all tenants
- ✅ 99%+ webhook delivery success rate
- ✅ 2FA enabled for all platform admins
- ✅ Zero rate limit bypass incidents
- ✅ < 30 seconds backup creation time
- ✅ < 5 minutes restore time (from backup to live)
- ✅ Comprehensive documentation for all systems

---

## 🛠️ Infrastructure Requirements

**Redis** (required):
- Email queue
- Rate limiting
- Background job processing

**S3-Compatible Storage** (required):
- Backup storage
- Email attachment storage (optional)

**Third-Party Services**:
- Email provider (Resend/SendGrid)
- Webhook testing tool (webhook.site)
- Monitoring (Sentry/DataDog)

**Compute Resources**:
- Background workers (email/webhook delivery)
- Cron jobs (backups, cleanup)
- Higher memory for backup operations

---

## 🎯 Common Issues & Solutions

**Email Bounces**: 
- Verify domain DNS records
- Check email reputation score
- Remove invalid emails from list

**Webhook Failures**:
- Check URL accessibility (not localhost)
- Verify HTTPS certificate valid
- Check webhook endpoint returns 200 status

**Backup Failures**:
- Check S3 credentials/permissions
- Ensure enough disk space
- Verify database connection stable

**2FA Lockouts**:
- Always test backup codes before enabling
- Provide admin recovery process
- Keep audit log of 2FA disables

**Rate Limit False Positives**:
- Whitelist known good IPs
- Use API keys for high-volume clients
- Implement sliding window algorithm

Good luck with Week 4! 🎉
