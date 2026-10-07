-- =========================================================================
-- EXECUTE SITE SYSTEM & ISOLATION SETUP (PHASE 1)
-- 1. Industry Type at Sites Level ONLY (Never on Tenants)
-- 2. PostgreSQL Row-Level Security (RLS) policies using 'app.tenant_id'
-- 3. Exclusion GIST Constraint on Engagements to avoid overlapping shift deployments
-- =========================================================================

-- Enable BTree-GIST for multi-column equality + range exclusion
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Sites Table (Industry Type defined ONLY here, NEVER on tenants)
CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    site_name VARCHAR(100) NOT NULL,
    site_code VARCHAR(30) NOT NULL,
    industry_type VARCHAR(50) NOT NULL DEFAULT 'HEALTHCARE', -- DEFINED ONLY AT SITES LEVEL
    city VARCHAR(50),
    address TEXT,
    location_lat DOUBLE PRECISION DEFAULT 19.0760,
    location_lng DOUBLE PRECISION DEFAULT 72.8777,
    radius_meters INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_industry ON sites(industry_type);

-- 2. Zones Table (Floor / Ward / Department mapping per site)
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    site_id VARCHAR(50) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    floor VARCHAR(30),
    department VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zones_tenant_site ON zones(tenant_id, site_id);

-- 3. Engagements Table (Separating Person Identity from Site Deployment)
-- Includes EXCLUDE USING GIST constraint to avoid overlapping shift deployments
CREATE TABLE IF NOT EXISTS engagements (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    site_id VARCHAR(50) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    person_id VARCHAR(50) NOT NULL, -- References users(staff_id)
    role VARCHAR(30) NOT NULL, -- 'MANAGER', 'SUPERVISOR', 'STAFF'
    shift_name VARCHAR(20) NOT NULL DEFAULT '7-3',
    department VARCHAR(50),
    valid_during TSTZRANGE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'SUSPENDED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Exclusion GIST constraint: avoid overlapping deployments at the same site for the same person
    CONSTRAINT exclude_overlapping_deployments EXCLUDE USING gist (
        site_id WITH =,
        person_id WITH =,
        valid_during WITH &&
    )
);

CREATE INDEX IF NOT EXISTS idx_engagements_tenant_site ON engagements(tenant_id, site_id);
CREATE INDEX IF NOT EXISTS idx_engagements_person ON engagements(person_id);

-- 4. Roster Entries Table (Daily Shift allocations)
CREATE TABLE IF NOT EXISTS roster_entries (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    site_id VARCHAR(50) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    engagement_id INTEGER REFERENCES engagements(id) ON DELETE SET NULL,
    person_id VARCHAR(50) NOT NULL,
    calendar_date DATE NOT NULL,
    shift_name VARCHAR(20) NOT NULL,
    department VARCHAR(50) NOT NULL,
    assigned_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roster_tenant_site_date ON roster_entries(tenant_id, site_id, calendar_date);

-- 5. Attendance Events Table (Raw Geofenced punch events)
CREATE TABLE IF NOT EXISTS attendance_events (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    site_id VARCHAR(50) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    person_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'PUNCH_IN', 'PUNCH_OUT'
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_events_tenant_site ON attendance_events(tenant_id, site_id, timestamp);

-- 6. Documents Table (Employee verified document storage)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    site_id VARCHAR(50) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    person_id VARCHAR(50) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    status VARCHAR(30) DEFAULT 'PENDING',
    verified_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_site ON documents(tenant_id, site_id);

-- Ensure users table has site_id column
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS site_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id);

-- =========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR ALL 7 TABLES USING app.tenant_id
-- =========================================================================

-- Enable RLS on all 7 tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 1. Sites Policy
DROP POLICY IF EXISTS tenant_isolation_sites ON sites;
CREATE POLICY tenant_isolation_sites ON sites
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);

-- 2. Zones Policy
DROP POLICY IF EXISTS tenant_isolation_zones ON zones;
CREATE POLICY tenant_isolation_zones ON zones
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);

-- 3. Users Policy
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);

-- 4. Engagements Policy
DROP POLICY IF EXISTS tenant_isolation_engagements ON engagements;
CREATE POLICY tenant_isolation_engagements ON engagements
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);

-- 5. Roster Entries Policy
DROP POLICY IF EXISTS tenant_isolation_roster ON roster_entries;
CREATE POLICY tenant_isolation_roster ON roster_entries
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);

-- 6. Attendance Events Policy
DROP POLICY IF EXISTS tenant_isolation_attendance_events ON attendance_events;
CREATE POLICY tenant_isolation_attendance_events ON attendance_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);

-- 7. Documents Policy
DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
CREATE POLICY tenant_isolation_documents ON documents
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.tenant_id', true) IS NULL);
