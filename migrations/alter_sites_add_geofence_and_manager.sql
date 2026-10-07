-- =========================================================================
-- ALTER TABLE sites: Add GPS Geofence & Primary Operations Manager Columns
-- =========================================================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION DEFAULT 19.0760;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION DEFAULT 72.8777;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 100;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS primary_manager_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_sites_primary_manager ON sites(primary_manager_id);
