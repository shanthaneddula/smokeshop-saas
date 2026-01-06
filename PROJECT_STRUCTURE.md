# Project Structure: SaaS Platform vs Tenant

## 📂 Repository Separation

### `smokeshop-saas` (This Repository)
**Purpose**: Multi-tenant SaaS Platform  
**What it does**: Manages multiple smoke shops, each with isolated databases  
**Git**: Separate repository with dev/prod branches  

**Key Components**:
- Master database (tenant registry)
- Tenant database schema template  
- Multi-tenant middleware
- Tenant provisioning scripts
- Product catalog (MongoDB)
- Platform admin tools

**Deployment**: Single platform instance serving all tenants via custom domains

---

### `zsmokeshop` (Separate Repository)
**Purpose**: Single Tenant Example  
**What it is**: Z Smoke Shop - one specific smoke shop business  
**Relationship**: Will become a TENANT of the platform  

**Current State**: 
- Single-tenant Next.js application
- Uses Redis/Vercel KV for storage
- Has existing products, orders, admin system
- NOT part of the SaaS platform codebase

**Future**: Can migrate to become a tenant in smokeshop-saas platform

---

## 🔄 How They Relate

```
┌─────────────────────────────────────────┐
│   smokeshop-saas (Platform)            │
│   - Manages ALL tenants                │
│   - Master database                    │
│   - Multi-tenant routing               │
│   - Shared product catalog             │
└─────────────────────────────────────────┘
         │
         │ serves via custom domains
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
   Joe's Smoke Shop   Mike's Vapes    [Z Smoke Shop]
   joesshop.com       mikesvapes.com   zsmokeshop.com
   (Tenant 1)         (Tenant 2)       (Future Tenant 3)
```

---

## 🚀 Development Workflow

### Working on Platform (smokeshop-saas)
```bash
cd ~/Desktop/smokeshop-saas
git checkout master          # or development/production
npm run dev                  # Port 3000
# Platform serves all tenants
```

### Working on Tenant Example (zsmokeshop)  
```bash
cd ~/Desktop/zsmokeshop
npm run dev                  # Port 3001
# Single shop, NOT connected to platform yet
```

---

## 📋 Key Differences

| Feature | smokeshop-saas | zsmokeshop |
|---------|---------------|------------|
| **Purpose** | SaaS Platform | Single Shop |
| **Database** | Master DB + Multiple Tenant DBs | Single Redis/KV |
| **Users** | Multiple tenants | One business |
| **Domains** | joesshop.com, mikesvapes.com, etc | zsmokeshop.com only |
| **Git Repo** | Platform codebase | Shop codebase |
| **Deployment** | One instance, all tenants | One shop only |

---

## 🎯 Next Steps

1. **smokeshop-saas**: Build platform features
   - Tenant onboarding UI
   - Product activation flow
   - Platform admin dashboard
   - Migration orchestrator

2. **zsmokeshop**: Can remain independent OR migrate to platform
   - Option 1: Keep as standalone single-tenant app
   - Option 2: Migrate data to become Tenant 3 in platform

---

## 📝 Important Notes

- **DO NOT** mix code between repositories
- `zsmokeshop` code should NOT be in `smokeshop-saas`  
- `smokeshop-saas` is the platform, not a specific shop
- Each tenant (shop) gets their own isolated database
- Tenants never see each other's data
