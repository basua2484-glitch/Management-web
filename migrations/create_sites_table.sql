-- =========================================================================
-- CREATE TABLE sites
-- Multi-Tenant Isolation by tenant_id (Master Company Isolation)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Master Company Isolation
    site_name VARCHAR(255) NOT NULL, -- e.g., "Site A - East Wing & Trauma"
    industry_type VARCHAR(50) NOT NULL, -- e.g., "HOSPITAL", "MALL", "CONSTRUCTION"
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_industry_type ON sites(industry_type);
