# 🏪 Smoke Shop SaaS Platform

**Multi-tenant POS and Inventory Management System for Smoke Shops**

A scalable SaaS platform where each smoke shop owner gets their own custom domain and isolated database.

## 🎯 Architecture

- **Custom Domains**: Each tenant has their own domain
- **Database Isolation**: Separate PostgreSQL per tenant  
- **Shared Product Catalog**: Centralized MongoDB with manufacturer specs
- **Tenant Registry**: Master DB tracks all tenants

## 🚀 Quick Start

```bash
npm install
npx prisma generate --schema=prisma/schema-master.prisma
npx prisma generate --schema=prisma/schema-tenant.prisma
npm run dev
```

## 📦 Branches

- **master**: Active development
- **development**: Testing/staging  
- **production**: Live deployment

## 📚 Documentation

See `/docs` folder for detailed architecture and setup guides.
