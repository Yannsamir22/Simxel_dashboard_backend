# Remote POS Config Sync — Implementation Note

## What the Dashboard does

When an owner changes POS passwords remotely via the Dashboard, it:

1. Updates (or creates) the `Config` record in the **cloud database**
2. Sets `config.isSynced = false` on that record

```
Cloud DB → Config {
  businessId: "...",
  mainPasswordHash: "new_hash",
  adminPasswordHash: "new_hash",
  isSynced: false   ← signals the POS to pull this
}
```

---

## What the POS Pull Sync needs to do

The POS `isSynced.service.ts` → `runPullSync()` already pulls entities like
`employee`, `service`, `product`, etc. It needs ONE additional step: pull `Config`.

Add this to the POS `runPullSync()`:

```typescript
// In isSynced.service.ts → runPullSync()

// After pulling other entities, pull Config:
await this.pullConfig(businessId);
```

And add this private method:

```typescript
private static async pullConfig(businessId: string) {
  // Fetch the cloud config for this business
  const cloudConfig = await cloudPrisma.config.findUnique({
    where: { businessId },
  });

  if (!cloudConfig) return;

  // Only pull if cloud has a newer/unsynced version
  if (!cloudConfig.isSynced) {
    // Upsert into local DB
    await LocalPrisma.config.upsert({
      where: { businessId },
      update: {
        mainPasswordHash: cloudConfig.mainPasswordHash,
        adminPasswordHash: cloudConfig.adminPasswordHash,
      },
      create: {
        businessId,
        mainPasswordHash: cloudConfig.mainPasswordHash,
        adminPasswordHash: cloudConfig.adminPasswordHash,
      },
    });

    // Mark as synced in the cloud so we don't re-pull unnecessarily
    await cloudPrisma.config.update({
      where: { businessId },
      data: { isSynced: true },
    });

    console.log("[Pull Sync] Config (POS passwords) updated from cloud.");
  }
}
```

---

## Flow Summary

```
Owner on Dashboard
        │
        │  PUT /api/businesses/:id/pos-config/admin-password
        │  Body: { currentAdminPassword, newAdminPassword }
        ▼
  BusinessService.changePosAdminPassword()
        │
        │  prisma.config.update({ adminPasswordHash: newHash, isSynced: false })
        ▼
  Cloud DB updated — isSynced: false
        │
        │  (next time POS syncs)
        ▼
  POS pullConfig() detects isSynced: false
        │
        │  Copies new hash to local DB
        │  Sets cloud isSynced: true
        ▼
  POS now uses the new password — owner can tell cashier the new password
```

---

## Security Notes

- The Dashboard **never returns** password hashes in any API response.
- Changing passwords requires knowing the **current admin password** (except full reset).
- Full reset (`POST /pos-config/reset`) can be used when the owner has lost all POS access.
  This is secured by the owner's Dashboard JWT (email + password login).
- The `isSynced: false` flag on Config is the only case in this system where the Dashboard
  intentionally sets `isSynced: false` — because this record *does* need to be pulled by the POS.
