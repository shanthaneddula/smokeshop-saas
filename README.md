# SmokeShop SaaS - Multi-Tenant POS Platform

Complete point-of-sale and e-commerce solution for smoke shop owners.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Tech Stack

- **Next.js 15** - React framework
- **MongoDB Atlas** - Master product catalog (free 512MB)
- **Supabase PostgreSQL** - Tenant data with RLS (free 500MB)
- **Prisma** - PostgreSQL ORM
- **Mongoose** - MongoDB ORM
- **Shadcn UI** - Component library
- **Tailwind CSS** - Styling

## 📊 Architecture

**Hybrid Database Approach**:
1. **MongoDB** - Shared master catalog (50K+ products from brands like GRAV, Puffco, Lookah)
2. **PostgreSQL** - Per-tenant data (orders, customers, inventory, POS transactions)

**Multi-Tenancy**: Row-Level Security (RLS) in PostgreSQL isolates tenant data automatically.

## 📁 Structure

```
src/
├── app/              # Next.js pages
├── components/       # React components
│   ├── ui/          # Shadcn components
│   ├── dashboard/   # Dashboard UI
│   └── pos/         # POS interface
├── lib/
│   ├── db/          # Database clients
│   │   ├── mongodb.ts
│   │   ├── prisma.ts
│   │   └── models.ts (Mongoose schemas)
│   └── auth/        # Authentication
└── types/           # TypeScript types

prisma/
└── schema.prisma    # PostgreSQL schema
```

## 🔧 Setup Steps

1. **MongoDB Atlas** (free):
   - Create cluster at https://cloud.mongodb.com
   - Add `MONGODB_URI` to `.env.local`

2. **Supabase** (free):
   - Create project at https://supabase.com
   - Add `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_*` to `.env.local`

3. **Initialize Prisma**:
```bash
npx prisma generate
npx prisma db push
```

## 📋 Features Roadmap

- ✅ Project setup & database schemas
- 🔄 Authentication & tenant isolation
- 📝 Organization registration
- 📝 Master catalog browser
- 📝 Product activation workflow
- 📝 POS system with barcode scanning
- 📝 Online pickup orders
- 📝 Customer management

## 💡 Development Workflow (UI-First)

1. Build UI with mock data
2. Use Shadcn components: `npx shadcn@latest add [component]`
3. Iterate on design with hot reload
4. Connect real database last

## 📖 Key Documentation

- Database schemas: See `prisma/schema.prisma` and `src/lib/db/models.ts`
- Environment setup: See `.env.local` template
- Type definitions: See `src/types/index.ts`
