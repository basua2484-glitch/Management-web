-- =========================================================================
-- QUERY: Unique Sites Deduplication (PostgreSQL)
-- SELECT DISTINCT ON (name) id, name, location FROM sites ORDER BY name;
-- =========================================================================

-- 1. Standard Distinct Query by Name:
SELECT DISTINCT ON (name) 
    id, 
    name, 
    location 
FROM sites 
ORDER BY name;

-- 2. Scoped by Tenant with Latest Created Site:
SELECT DISTINCT ON (name) 
    id, 
    name, 
    location,
    industry_type,
    location_lat,
    location_lng,
    radius_meters,
    primary_manager_id,
    created_at
FROM sites 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY name, created_at DESC;
