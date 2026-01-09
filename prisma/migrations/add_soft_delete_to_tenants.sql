-- Add soft delete fields to tenants table
ALTER TABLE tenants 
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN deletion_reason TEXT;

-- Create index for deleted_at for faster queries
CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN tenants.deleted_at IS 'Soft delete timestamp. NULL = active, NOT NULL = deleted with 30-day recovery window';
COMMENT ON COLUMN tenants.deletion_reason IS 'Optional reason for tenant deletion (e.g., "Payment failed", "User requested", "Policy violation")';
