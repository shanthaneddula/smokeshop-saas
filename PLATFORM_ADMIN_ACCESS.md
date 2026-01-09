# Platform Admin Access

## Overview

The platform has **two separate login systems**:

1. **Tenant Login** (`/login`) - For smoke shop owners/staff
   - Logs into their specific tenant database
   - Domain-based (e.g., joessmokeshop.com)
   - Uses tenant database for authentication

2. **Platform Admin Login** (`/platform/login`) - For YOU (SaaS provider)
   - Manages all tenants from master database
   - View all smoke shops, stats, activity
   - Uses master database `admin_users` table

## Create Your First Platform Admin

Run this command to create a platform admin account:

```bash
cd /Users/shanthaneddula/Desktop/smokeshop-saas
npx tsx scripts/create-platform-admin.ts
```

You'll be prompted for:
- Admin Name (e.g., "Your Name")
- Admin Email (e.g., "admin@yourdomain.com")
- Password (min 8 characters)
- Role (admin/support/developer)

## Login as Platform Admin

1. Navigate to: **http://localhost:3000/platform/login**
2. Enter your admin credentials
3. You'll see the platform dashboard with:
   - Total tenants count
   - Active/Trial/Suspended stats
   - List of all smoke shop tenants
   - Tenant details (domain, owner, plan, status)

## Platform Admin Features

**Current:**
- ✅ View all tenants
- ✅ See tenant stats
- ✅ Tenant status monitoring
- ✅ Secure JWT authentication

**Coming Soon:**
- Create new tenants
- Suspend/activate tenants
- Change tenant plans
- View tenant activity logs
- Database migration management
- Billing integration

## Architecture Separation

### Tenant Flow
```
joessmokeshop.com → Middleware → Tenant Lookup → Tenant DB → Joe's Data
```

### Platform Admin Flow
```
localhost:3000/platform → Platform Auth → Master DB → All Tenants Data
```

**Key Differences:**
- Tenant login: Uses `auth-token` cookie, queries tenant DB
- Platform login: Uses `platform-auth-token` cookie, queries master DB
- Complete separation of auth systems
- Platform admins CANNOT login as tenants (by design)
- Tenants CANNOT access platform admin

## Security Notes

- Platform admin passwords hashed with bcrypt (12 rounds)
- JWT tokens signed with separate audience/issuer
- httpOnly cookies prevent XSS attacks
- Role-based access control ready (admin/support/developer)
- Inactive admins automatically blocked

## Quick Test

After creating admin account:

```bash
# Start dev server
npm run dev

# Open platform login
open http://localhost:3000/platform/login

# Login with your admin credentials
# You should see the dashboard with Joe's Smoke Shop listed
```
