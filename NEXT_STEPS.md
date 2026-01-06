# 🎯 Immediate Action Items

## What You Need to Do RIGHT NOW

### 1. Set Up MongoDB Atlas (5 minutes)

1. Visit: https://cloud.mongodb.com/
2. Sign up or log in
3. Click "Build a Database"
4. Select **M0 FREE** tier
5. Choose cloud provider (AWS recommended)
6. Choose region closest to you
7. Click "Create Cluster"
8. **Create Database User**:
   - Username: `smokeshop_admin`
   - Password: Generate a strong password (save it!)
9. **Network Access**:
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0) for development
10. **Get Connection String**:
    - Click "Connect" on your cluster
    - Choose "Connect your application"
    - Copy the connection string
    - Replace `<password>` with your actual password
    - Add database name: `...mongodb.net/smokeshop-catalog?retryWrites=true...`

Example:
```
mongodb+srv://smokeshop_admin:YOUR_PASSWORD@cluster0.abc123.mongodb.net/smokeshop-catalog?retryWrites=true&w=majority
```

### 2. Set Up Supabase (5 minutes)

1. Visit: https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: `smokeshop-saas`
   - **Database Password**: Generate strong password (save it!): hPUj9MhpvqSIy2aJ
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free
5. Wait 2-3 minutes for project to provision
6. **Get Credentials**:
   - Go to **Project Settings** (gear icon) → **API**
   - Copy:
     - **Project URL** (`https://xxx.supabase.co`) : https://gxgmtgkepikakcfpncyg.supabase.co
     - **anon public** key (long string starting with `eyJ...`) eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Z210Z2tlcGlrYWtjZnBuY3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDQzNjQsImV4cCI6MjA4MzEyMDM2NH0.SUzfrvFo-TNKtkNi27esmNcc7t5Y4DBcjGxM9kedVUQ
   - Go to **Database** tab
   - Copy **Connection String** (URI format)
   - Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Update .env.local File

Open `/Users/shanthaneddula/Desktop/smokeshop-saas/.env.local` and fill in:

```env
# MongoDB Atlas - Paste your connection string
MONGODB_URI="mongodb+srv://shanthaneddula_db_user:pBE2jVSozfEHmFQi@cluster0.n6m43gv.mongodb.net/"

# Supabase - Paste your credentials
NEXT_PUBLIC_SUPABASE_URL="https://gxgmtgkepikakcfpncyg.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Z210Z2tlcGlrYWtjZnBuY3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDQzNjQsImV4cCI6MjA4MzEyMDM2NH0.SUzfrvFo-TNKtkNi27esmNcc7t5Y4DBcjGxM9kedVUQ"
DATABASE_URL="postgresql://postgres:hPUj9MhpvqSIy2aJ@db.gxgmtgkepikakcfpncyg.supabase.co:5432/postgres"

# JWT Secret - Generate random string
JWT_SECRET="0d6cef8c-475a-4e20-a851-9ab85a753063"

# Leave these as-is for now
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"


NEXT_PUBLIC_SUPABASE_URL=https://gxgmtgkepikakcfpncyg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_UzOGidlOnbCWkqWhQJm-mA_kaL94HyF

```

### 4. Initialize Your Database

In terminal (make sure dev server is stopped first):

```bash
cd /Users/shanthaneddula/Desktop/smokeshop-saas

# Stop dev server if running (Ctrl+C)

# Generate Prisma client
npx prisma generate

# Create all tables in Supabase
npx prisma db push

# You should see:
# ✔ Generated Prisma Client
# ✔ Your database is now in sync with your schema
```

### 5. Verify Everything Works

Start dev server:
```bash
npm run dev
```

Visit: http://localhost:3000

You should see the landing page with no errors!

## ✅ Checklist

- [ ] MongoDB Atlas account created
- [ ] Free M0 cluster running
- [ ] MongoDB connection string in `.env.local`
- [ ] Supabase project created
- [ ] Supabase credentials in `.env.local`
- [ ] `npx prisma generate` completed successfully
- [ ] `npx prisma db push` completed successfully
- [ ] Dev server runs without errors
- [ ] Landing page loads at http://localhost:3000

## 🐛 Common Issues

### "Can't connect to MongoDB"
- Check if IP is whitelisted (0.0.0.0/0 for dev)
- Verify password has no special characters that need escaping
- Ensure database name is in the connection string

### "Prisma errors"
- Make sure `DATABASE_URL` is correct in `.env.local`
- Try: `rm -rf node_modules && npm install`
- Run: `npx prisma generate` again

### "Port 3000 already in use"
- Kill existing process: `lsof -ti:3000 | xargs kill -9`
- Or use different port: `npm run dev -- -p 3001`

## 📞 Stuck?

If you hit any blockers:
1. Check error message in terminal
2. Google the exact error message
3. Check Supabase/MongoDB Atlas status pages
4. Ensure all env variables are filled in correctly

## 🚀 Once Setup is Complete

You're ready to start building features! Next steps:
1. Create authentication system (login/register)
2. Build organization registration flow
3. Create admin dashboard
4. Build product catalog browser

---

**Current Status**: ⏸️ Waiting for database credentials

Once you complete steps 1-5 above, you'll be ready to build the actual application features!
