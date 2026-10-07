-- =========================================================================
-- DATABASE CLEANUP: REMOVE ALL DUMMY / MOCK TESTING DATA
-- Retains ONLY the primary actual Master Admin user account: Dr. Basu (BASU-ADM-001)
-- =========================================================================

-- 1. Delete mock attendance events
DELETE FROM attendance_events 
WHERE person_id NOT IN ('BASU-ADM-001');

-- 2. Delete mock roster entries
DELETE FROM roster_entries 
WHERE person_id NOT IN ('BASU-ADM-001');

-- 3. Delete mock engagements
DELETE FROM engagements 
WHERE person_id NOT IN (
    SELECT id FROM users WHERE staff_id = 'BASU-ADM-001'
)
AND person_id != 'BASU-ADM-001';

-- 4. Delete mock users and testing entries, keeping ONLY Master Admin
DELETE FROM users 
WHERE staff_id NOT IN ('BASU-ADM-001');

-- 5. Ensure Master Admin record exists and is active in database
INSERT INTO users (
    id,
    staff_id,
    username,
    full_name,
    role,
    tenant_id,
    status,
    is_approved,
    created_at
)
VALUES (
    gen_random_uuid(),
    'BASU-ADM-001',
    'basu.admin',
    'Dr. Basu',
    'admin',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'ACTIVE',
    TRUE,
    NOW()
)
ON CONFLICT (staff_id) DO UPDATE 
SET full_name = 'Dr. Basu',
    status = 'ACTIVE',
    is_approved = TRUE;
