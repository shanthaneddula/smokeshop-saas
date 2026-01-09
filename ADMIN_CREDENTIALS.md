# Platform Admin Credentials & Quick Reference

## 🔐 Your Platform Admin Login

**Login URL**: http://localhost:3000/platform/login

**Credentials:**
- **Email**: `shanthaneddula@gmail.com`
- **Password**: `Dushyanth@501`
- **Role**: `admin`

## 📍 Platform Admin URLs

| Page | URL | Description |
|------|-----|-------------|
| **Login** | `/platform/login` | Platform admin login page |
| **Dashboard** | `/platform/dashboard` | Tenant overview & stats |
| **Products** | `/platform/products` | Master product catalog |
| **Edit Product** | `/platform/products/[id]` | Edit product details |

## 🆚 Two Login Systems

### Tenant Login (`/login`)
- **Who**: Smoke shop owners/staff (Joe, Mike, etc.)
- **Database**: Individual tenant PostgreSQL
- **Access**: Their shop data only
- **Example**: joe@joessmokeshop.com logs into Joe's Smoke Shop

### Platform Admin Login (`/platform/login`)
- **Who**: YOU (SaaS provider)
- **Database**: Master PostgreSQL + MongoDB
- **Access**: ALL tenants + product catalog
- **Example**: shanthaneddula@gmail.com manages the entire platform

## 📦 Master Catalog Status

**Sample Products Added (6):**
1. Puffco Peak Pro - $399.99
2. RAW Classic King Size Slim - $2.99
3. Storz & Bickel Mighty+ - $399.00
4. GRAV Helix Beaker Bong - $129.99
5. Clipper Lighter 4-Pack - $7.99
6. Santa Cruz Shredder Medium 4-Piece - $64.99

## 🚀 Quick Actions

### Create Additional Admin Users
```bash
cd /Users/shanthaneddula/Desktop/smokeshop-saas
npx tsx scripts/create-platform-admin.ts
```

### Add More Products to Catalog
```bash
npx tsx scripts/add-sample-products.ts
```

### View All Tenants
1. Login at `/platform/login`
2. Dashboard shows: Joe's Smoke Shop (active, starter plan)

### Manage Products
1. Login at `/platform/login`
2. Click "📦 Products" button
3. View/Edit/Delete products
4. Search by name, barcode, or brand

## 🔧 Development Commands

```bash
# Start dev server
npm run dev

# Generate Prisma clients
npx prisma generate --schema=prisma/schema-master.prisma
npx prisma generate --schema=prisma/schema-tenant.prisma

# View master database
npx prisma studio --schema=prisma/schema-master.prisma
```

## 🗄️ Database Access

**Master Database** (Platform data):
- URL: gxgmtgkepikakcfpncyg.supabase.co
- Tables: tenants, admin_users, tenant_migrations, platform_settings

**MongoDB** (Product catalog):
- Connection: cluster0.n6m43gv.mongodb.net
- Database: smokeshop-catalog
- Collection: products

**Tenant 1 Database** (Joe's Smoke Shop):
- URL: uxwqhvfbtfrvuvbezrdw.supabase.co
- Tables: users, stores, products, orders, pos_transactions

## 🎯 What You Can Do Now

✅ **View all tenants** - Dashboard shows Joe's Smoke Shop  
✅ **Manage product catalog** - 6 sample products loaded  
✅ **Search/filter products** - By name, barcode, brand  
✅ **Edit product details** - Update specs, prices, images  
✅ **Delete products** - Remove from master catalog  
✅ **Monitor tenant status** - Active/trial/suspended  

## 🔮 Coming Next

Ask Copilot to build:
- 📝 Create new tenant from dashboard
- ⏸️ Suspend/activate tenants
- 💰 Change tenant subscription plans
- 📊 Tenant analytics & metrics
- 🔄 Database migration tools
- 💳 Billing/payment integration
- 📤 Bulk product import from CSV
- 🖼️ Image upload for products
- 📱 Product barcode scanning

## 📞 Support

If you need to reset your admin password or create new admins, run:
```bash
npx tsx scripts/create-platform-admin.ts
```

---

**🎉 You're all set!** Login now at: http://localhost:3000/platform/login
