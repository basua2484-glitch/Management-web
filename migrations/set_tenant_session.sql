-- =========================================================================
-- Har request / transaction se pehle session parameter set karein:
-- SET LOCAL app.tenant_id = 'your-tenant-uuid-here';
-- =========================================================================

-- 1. Ensure tenant_id column exists on all tables
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE IF EXISTS staff_requests ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE IF EXISTS staff_duty_profiles ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE IF EXISTS duty_allocations ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);

-- Indexes for performance on tenant lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_duty_allocations_tenant ON duty_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_requests_tenant ON staff_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_duty_profiles_tenant ON staff_duty_profiles(tenant_id);

-- 2. Helper function to set the tenant parameter for the current session/transaction
-- Usage: SELECT set_current_tenant('tenant-uuid'); or SET LOCAL app.tenant_id = 'your-tenant-uuid-here';
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id TEXT) 
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.tenant_id', p_tenant_id, true);
END;
$$ LANGUAGE plpgsql;

-- 3. Row Level Security (RLS) Policies enforcing SET LOCAL app.tenant_id
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_duty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_allocations ENABLE ROW LEVEL SECURITY;

-- Dynamic tenant isolation policy based on session parameter app.tenant_id
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '')
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');

DROP POLICY IF EXISTS tenant_isolation_attendance ON attendance_records;
CREATE POLICY tenant_isolation_attendance ON attendance_records
  USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '')
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');

DROP POLICY IF EXISTS tenant_isolation_duty ON duty_allocations;
CREATE POLICY tenant_isolation_duty ON duty_allocations
  USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '')
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');

DROP POLICY IF EXISTS tenant_isolation_staff_requests ON staff_requests;
CREATE POLICY tenant_isolation_staff_requests ON staff_requests
  USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '')
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');

DROP POLICY IF EXISTS tenant_isolation_profiles ON staff_duty_profiles;
CREATE POLICY tenant_isolation_profiles ON staff_duty_profiles
  USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '')
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');
