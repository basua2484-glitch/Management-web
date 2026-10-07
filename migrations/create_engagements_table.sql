-- =========================================================================
-- CREATE TABLE engagements
-- Worker deployment separating Person (Identity) from Site deployment
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL, -- Worker's Master Identity
    site_id UUID REFERENCES sites(id),
    duty_type VARCHAR(50), -- "FIXED", "RELIEVER"
    shift_code VARCHAR(50), -- "7-3 (Morning)", "3-11 (Evening)"
    is_active BOOLEAN DEFAULT TRUE,
    tenant_id UUID NOT NULL
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_engagements_person_id ON engagements(person_id);
CREATE INDEX IF NOT EXISTS idx_engagements_site_id ON engagements(site_id);
CREATE INDEX IF NOT EXISTS idx_engagements_tenant_id ON engagements(tenant_id);
