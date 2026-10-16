-- =========================================================================
-- ALTER TABLE sites: Add GPS Geofence & Primary Operations Manager Columns
-- Ensure name and location columns exist for DISTINCT queries
-- =========================================================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION DEFAULT 19.0760;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION DEFAULT 72.8777;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 100;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS primary_manager_id VARCHAR(50);

-- Backfill from site_name and address if needed
UPDATE sites SET name = site_name WHERE name IS NULL AND site_name IS NOT NULL;
UPDATE sites SET location = address WHERE location IS NULL AND address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);
CREATE INDEX IF NOT EXISTS idx_sites_primary_manager ON sites(primary_manager_id);
