-- =========================================================================
-- CREATE TABLE sites
-- Multi-Tenant Isolation by tenant_id (Master Company Isolation)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Master Company Isolation
    name VARCHAR(255) NOT NULL, -- e.g., "Site A - East Wing & Trauma"
    site_name VARCHAR(255), -- Alias for backward compatibility
    industry_type VARCHAR(50) NOT NULL, -- e.g., "HOSPITAL", "MALL", "CONSTRUCTION"
    location TEXT, -- e.g., physical address or coordinates
    address TEXT, -- Alias for backward compatibility
    location_lat DOUBLE PRECISION DEFAULT 19.0760,
    location_lng DOUBLE PRECISION DEFAULT 72.8777,
    radius_meters INTEGER DEFAULT 100,
    primary_manager_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);
CREATE INDEX IF NOT EXISTS idx_sites_industry_type ON sites(industry_type);
