# 🔐 Security Setup Guide - Database Password Encryption

## Overview
This guide helps you set up database password encryption for tenant credentials. **This is required before running the application in production.**

---

## Step 1: Generate Encryption Key

Run this command to generate a secure 256-bit encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

## Step 2: Add to Environment Variables

### Local Development (.env.local)
```bash
# Database Password Encryption Key (KEEP SECRET!)
DB_PASSWORD_ENCRYPTION_KEY=your_64_character_hex_key_here
```

### Production (Vercel)
```bash
# Via Vercel CLI
vercel env add DB_PASSWORD_ENCRYPTION_KEY production
# Paste your key when prompted

# Or via Vercel Dashboard:
# 1. Go to your project settings
# 2. Navigate to Environment Variables
# 3. Add DB_PASSWORD_ENCRYPTION_KEY
# 4. Set value and mark as "Production"
# 5. ⚠️ DO NOT expose to Preview or Development
```

---

## Step 3: Test Encryption Setup

```bash
npx tsx scripts/test-encryption.ts
```

Expected output:
```
✅ Encryption key configured
✅ Encryption/decryption test passed
✅ All checks passed!
```

---

## Step 4: Encrypt Existing Passwords

**⚠️ IMPORTANT: Backup your database before running this!**

```bash
# 1. Backup master database
pg_dump $MASTER_DATABASE_URL > master_backup.sql

# 2. Run encryption migration (dry run first)
npx tsx scripts/encrypt-tenant-passwords.ts

# The script will:
# - Show you what will be encrypted
# - Ask for confirmation
# - Encrypt all plain text passwords
# - Verify encryption worked
```

---

## Security Best Practices

### 1. **Key Storage**
- ✅ DO: Store in environment variables
- ✅ DO: Use secret managers (Vercel Secrets, AWS Secrets Manager, HashiCorp Vault)
- ❌ DON'T: Commit keys to Git
- ❌ DON'T: Hard-code keys in source code
- ❌ DON'T: Share keys via email/Slack

### 2. **Key Rotation**
Rotate encryption keys every 90-180 days:

```bash
# 1. Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Update environment variable
vercel env add DB_PASSWORD_ENCRYPTION_KEY production

# 3. Run re-encryption script
npx tsx scripts/rotate-encryption-key.ts --old-key $OLD_KEY --new-key $NEW_KEY
```

### 3. **Access Control**
- Limit who can view environment variables
- Use Vercel's team access controls
- Audit access logs regularly

### 4. **Monitoring**
Set up alerts for:
- Failed decryption attempts
- Unusual database access patterns
- Environment variable changes

---

## Troubleshooting

### Error: "DB_PASSWORD_ENCRYPTION_KEY is not set"
**Solution**: Add the key to your .env.local file

```bash
echo "DB_PASSWORD_ENCRYPTION_KEY=$(node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")" >> .env.local
```

### Error: "Invalid encryption key format"
**Solution**: Key must be exactly 64 hex characters

```bash
# Check key length
echo -n $DB_PASSWORD_ENCRYPTION_KEY | wc -c
# Should output: 64

# Validate hex format
echo $DB_PASSWORD_ENCRYPTION_KEY | grep -E '^[0-9a-fA-F]{64}$'
# Should output the key if valid
```

### Error: "Failed to decrypt password"
**Possible causes:**
1. Encryption key was changed
2. Database was restored from old backup
3. Password was manually edited in database

**Solution**: Reset tenant password

```bash
npx tsx scripts/reset-tenant-password.ts --tenant-id <tenant-id> --new-password <password>
```

---

## For Developers

### Testing Encryption Locally

```typescript
import {
  encryptDatabasePassword,
  decryptDatabasePassword,
  testEncryption,
} from '@/lib/security/encryption';

// Test basic encryption
const testPassword = 'mySecurePassword123';
const encrypted = await encryptDatabasePassword(testPassword);
console.log('Encrypted:', encrypted);

const decrypted = await decryptDatabasePassword(encrypted);
console.log('Decrypted:', decrypted);
console.assert(decrypted === testPassword);

// Run full test suite
const passed = await testEncryption();
console.log('Test passed:', passed);
```

### Checking if Password is Encrypted

```typescript
import { isEncrypted } from '@/lib/security/encryption';

const tenant = await getTenantByDomain('example.com');
if (!isEncrypted(tenant.dbPassword)) {
  console.warn('⚠️ Tenant password is not encrypted!');
}
```

---

## Migration Checklist

- [ ] Generate encryption key
- [ ] Add key to .env.local
- [ ] Test encryption setup
- [ ] Backup master database
- [ ] Run encryption migration
- [ ] Verify all passwords encrypted
- [ ] Add key to Vercel environment variables
- [ ] Deploy to production
- [ ] Test production deployment
- [ ] Document key location in password manager
- [ ] Set calendar reminder for key rotation (90 days)

---

## Additional Resources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review logs: `tail -f logs/encryption.log`
3. Contact platform admin team
4. Reference: PLATFORM_GAPS_AND_IMPROVEMENTS.md Section 1.1
