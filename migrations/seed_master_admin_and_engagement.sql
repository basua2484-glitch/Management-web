-- =========================================================================
-- SEED MASTER ADMIN (DR. BASU) AND ACTIVE ENGAGEMENT
-- Guarantees 1 active admin record with LEFT JOIN engagements
-- =========================================================================

-- 1. Ensure default site exists
INSERT INTO sites (id, tenant_id, site_name, industry_type, address, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Site A - East Wing & Trauma',
    'HOSPITAL',
    'Apex Medical Campus, North Wing',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Dr. Basu into users table
INSERT INTO users (
    id,
    staff_id,
    username,
    full_name,
    role,
    tenant_id,
    site_id,
    status,
    is_approved,
    created_at
)
VALUES (
    '00000000-0000-0000-0000-000000000010'::uuid,
    'BASU-ADM-001',
    'basu.admin',
    'Dr. Basu',
    'admin',
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'ACTIVE',
    TRUE,
    NOW()
)
ON CONFLICT (staff_id) DO UPDATE 
SET full_name = 'Dr. Basu',
    role = 'admin',
    status = 'ACTIVE',
    is_approved = TRUE;

-- 3. Insert active engagement entry for BASU-ADM-001 linked to default site
INSERT INTO engagements (
    id,
    person_id,
    site_id,
    duty_type,
    shift_code,
    is_active,
    tenant_id
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'FIXED',
    'General',
    TRUE,
    '00000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (id) DO NOTHING;

-- 4. Verification query testing LEFT JOIN engagements
-- Returns 1 active admin record even if site mapping varies or under "All Sites (Global)"
SELECT DISTINCT ON (u.id)
    u.id,
    u.staff_id,
    u.full_name,
    u.role,
    u.status,
    e.duty_type,
    e.shift_code,
    e.is_active AS engagement_active,
    s.site_name
FROM users u
LEFT JOIN engagements e ON (u.id = e.person_id OR u.staff_id = e.person_id::text)
LEFT JOIN sites s ON (e.site_id = s.id OR u.site_id = s.id)
WHERE u.staff_id = 'BASU-ADM-001';
