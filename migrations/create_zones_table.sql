-- =========================================================================
-- CREATE TABLE zones
-- Site zones with foreign key to sites(id) and multi-tenant isolation
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL, -- e.g., "OPD", "ICU 3rd Floor", "Food Court"
    tenant_id UUID NOT NULL
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_zones_site_id ON zones(site_id);
CREATE INDEX IF NOT EXISTS idx_zones_tenant_id ON zones(tenant_id);
