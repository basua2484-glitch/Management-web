import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, text
try:
    from .geofence import verify_hospital_geofence, calculate_distance_meters, HOSPITAL_LAT, HOSPITAL_LNG, MAX_ALLOWED_RADIUS_METERS
except ImportError:
    from geofence import verify_hospital_geofence, calculate_distance_meters, HOSPITAL_LAT, HOSPITAL_LNG, MAX_ALLOWED_RADIUS_METERS

db = SQLAlchemy()

# =========================================================================
# Multi-Tenancy & Session Parameter Setting (Row-Level Security)
# Har request / transaction se pehle session parameter set karein:
# SET LOCAL app.tenant_id = 'your-tenant-uuid-here';
# =========================================================================

def set_tenant_session(tenant_id: str):
    """
    Sets the session parameter for the current transaction/connection:
    SET LOCAL app.tenant_id = 'your-tenant-uuid-here';
    """
    try:
        from flask import g
        g.tenant_id = str(tenant_id)
    except Exception:
        pass
    if db.session.is_active:
        try:
            db.session.execute(text("SET LOCAL app.tenant_id = :tenant_id"), {"tenant_id": str(tenant_id)})
        except Exception as e:
            pass

@event.listens_for(db.session, 'after_begin')
def receive_after_begin(session, transaction, connection):
    """
    Automatically executes SET LOCAL app.tenant_id before every transaction
    """
    tenant_id = None
    try:
        from flask import g
        tenant_id = getattr(g, 'tenant_id', None)
    except Exception:
        tenant_id = None

    if not tenant_id:
        tenant_id = getattr(session, 'tenant_id', None)

    if tenant_id:
        connection.execute(text("SET LOCAL app.tenant_id = :tenant_id"), {"tenant_id": str(tenant_id)})

# 1. User Account Model (Complete Hierarchy & Admin Vault)
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=True, index=True)  # Multi-tenant isolation UUID/Prefix
    staff_id = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g. HK-012
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'admin', 'manager', 'supervisor', 'staff'
    assigned_area = db.Column(db.String(50), nullable=True)  # e.g. 'General Ward', 'ICU'
    assigned_shift = db.Column(db.String(20), default='7-3', nullable=True)  # '7-3', '3-11', '11-7'
    
    # Duty Allocation Settings & Reliever Overrides
    duty_type = db.Column(db.String(30), default='FIXED', nullable=True)  # 'FIXED', 'PERMANENT_RELIEVER', 'TEMP_RELIEVER'
    fixed_department = db.Column(db.String(50), nullable=True)
    is_temp_reliever = db.Column(db.Boolean, default=False, nullable=True)
    temp_department = db.Column(db.String(50), nullable=True)
    
    password_hash = db.Column(db.String(255), nullable=False)
    # Admin Vault Support (Decryption key restricted to Admin role only)
    raw_password_vault = db.Column(db.String(255), nullable=True)  # Admin Eye Icon View
    
    status = db.Column(db.String(20), default='ACTIVE', nullable=False)  # 'ACTIVE', 'PENDING_APPROVAL', 'DISABLED'

    def to_dict(self, include_vault=False):
        data = {
            'id': self.id,
            'staff_id': self.staff_id,
            'full_name': self.full_name,
            'role': self.role,
            'assigned_area': self.assigned_area or self.fixed_department,
            'assigned_shift': self.assigned_shift,
            'duty_type': self.duty_type or 'FIXED',
            'fixed_department': self.fixed_department or self.assigned_area,
            'is_temp_reliever': self.is_temp_reliever or False,
            'temp_department': self.temp_department,
            'status': self.status,
        }
        if include_vault:
            data['raw_password_vault'] = self.raw_password_vault
        return data


# 2. Staff Joining Request Queue Model
class StaffRequest(db.Model):
    __tablename__ = 'staff_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=True, index=True)
    requested_by = db.Column(db.String(50), nullable=True, index=True)  # Supervisor Staff ID
    candidate_name = db.Column(db.String(100), nullable=False)
    proposed_area = db.Column(db.String(50), nullable=True)
    proposed_shift = db.Column(db.String(20), default='7-3', nullable=True)
    status = db.Column(db.String(20), default='PENDING', nullable=False)  # 'PENDING', 'APPROVED', 'REJECTED'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'requested_by': self.requested_by,
            'candidate_name': self.candidate_name,
            'proposed_area': self.proposed_area,
            'proposed_shift': self.proposed_shift,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# 3. Attendance & Shift OT Log Model
class AttendanceRecord(db.Model):
    __tablename__ = 'attendance_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=True, index=True)
    staff_id = db.Column(db.String(50), nullable=False, index=True)
    calendar_date = db.Column(db.Date, nullable=False, index=True)  # YYYY-MM-DD
    shift_name = db.Column(db.String(20), nullable=False)  # '7-3', '3-11', '11-7'
    department_worked = db.Column(db.String(50), nullable=False)
    
    punch_in_time = db.Column(db.DateTime, nullable=False)
    punch_out_time = db.Column(db.DateTime, nullable=True)
    
    regular_hours = db.Column(db.Float, default=0.0, nullable=False)  # Up to 8.0 hrs
    ot_hours = db.Column(db.Float, default=0.0, nullable=False)  # Hours beyond 8.0 hrs
    ot_status = db.Column(db.String(20), default='NONE', nullable=False)  # 'NONE', 'PENDING', 'APPROVED', 'REJECTED'

    # Geofence location audit fields (Hospital Center: 19.0760, 72.8777; Max 100m)
    punch_in_lat = db.Column(db.Float, nullable=True)
    punch_in_lng = db.Column(db.Float, nullable=True)
    punch_in_distance_meters = db.Column(db.Float, nullable=True)
    punch_out_lat = db.Column(db.Float, nullable=True)
    punch_out_lng = db.Column(db.Float, nullable=True)
    punch_out_distance_meters = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'staff_id': self.staff_id,
            'calendar_date': self.calendar_date.isoformat() if self.calendar_date else None,
            'shift_name': self.shift_name,
            'department_worked': self.department_worked,
            'punch_in_time': self.punch_in_time.isoformat() if self.punch_in_time else None,
            'punch_out_time': self.punch_out_time.isoformat() if self.punch_out_time else None,
            'regular_hours': self.regular_hours,
            'ot_hours': self.ot_hours,
            'ot_status': self.ot_status,
            'punch_in_lat': self.punch_in_lat,
            'punch_in_lng': self.punch_in_lng,
            'punch_in_distance_meters': self.punch_in_distance_meters,
            'punch_out_lat': self.punch_out_lat,
            'punch_out_lng': self.punch_out_lng,
            'punch_out_distance_meters': self.punch_out_distance_meters,
        }


# 4. User Profile Extensions
class StaffDutyProfile(db.Model):
    __tablename__ = 'staff_duty_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=True, index=True)
    staff_id = db.Column(db.String(50), nullable=False, unique=True, index=True)
    
    # Primary Role: 'FIXED' or 'PERMANENT_RELIEVER'
    duty_type = db.Column(db.String(30), default='FIXED', nullable=False) 
    
    # Default Fixed Department (e.g., 'ICU')
    fixed_department = db.Column(db.String(50), nullable=True) 
    
    # Temporary Shift Override (Today's Reliever Duty)
    is_temp_reliever = db.Column(db.Boolean, default=False, nullable=False)
    temp_assigned_department = db.Column(db.String(50), nullable=True)
    temp_assigned_date = db.Column(db.Date, nullable=True)
    
    # Updated By Track
    last_updated_by = db.Column(db.String(50), nullable=True) # Staff ID of Admin/Manager/Supervisor

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'staff_id': self.staff_id,
            'duty_type': self.duty_type,
            'fixed_department': self.fixed_department,
            'default_department': self.fixed_department,  # backwards compatibility alias
            'is_temp_reliever': self.is_temp_reliever,
            'temp_assigned_department': self.temp_assigned_department,
            'temp_assigned_date': self.temp_assigned_date.isoformat() if self.temp_assigned_date else None,
            'last_updated_by': self.last_updated_by,
        }


# 5. Daily Duty & Overtime Tracking
class DutyAllocation(db.Model):
    __tablename__ = 'duty_allocations'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=True, index=True)
    staff_id = db.Column(db.String(50), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    assigned_department = db.Column(db.String(50), nullable=False)
    assigned_by_supervisor = db.Column(db.String(50), nullable=True)  # Supervisor Staff ID if Reliever
    
    # OT Request Tracking
    ot_requested_hours = db.Column(db.Float, default=0.0, nullable=False)
    ot_status = db.Column(db.String(20), default='NONE', nullable=False)  # 'NONE', 'PENDING', 'APPROVED', 'REJECTED'
    approved_by = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'staff_id': self.staff_id,
            'date': self.date.isoformat() if self.date else None,
            'assigned_department': self.assigned_department,
            'assigned_by_supervisor': self.assigned_by_supervisor,
            'ot_requested_hours': self.ot_requested_hours,
            'ot_status': self.ot_status,
            'approved_by': self.approved_by,
        }


# =========================================================================
# SITE SYSTEM & ISOLATION (PHASE 1 MODELS)
# 1. Industry Type is defined ONLY on Site (Never on Tenant)
# 2. Separation of Person Identity (User) and Site Deployment (Engagement)
# =========================================================================

class Site(db.Model):
    __tablename__ = 'sites'
    
    # UUID Primary Key with gen_random_uuid() / uuid4
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False, index=True)  # Master Company Isolation (UUID)
    site_name = db.Column(db.String(255), nullable=False)  # e.g., "Site A - East Wing & Trauma"
    industry_type = db.Column(db.String(50), nullable=False, index=True)  # e.g., "HOSPITAL", "COMMERCIAL", "HOTEL"
    address = db.Column(db.Text, nullable=True)
    location_lat = db.Column(db.Float, default=19.0760, nullable=True)
    location_lng = db.Column(db.Float, default=72.8777, nullable=True)
    radius_meters = db.Column(db.Integer, default=100, nullable=True)
    primary_manager_id = db.Column(db.String(50), nullable=True)  # Assigned Operations Manager
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'site_name': self.site_name,
            'industry_type': self.industry_type,
            'address': self.address,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'radius_meters': self.radius_meters,
            'primary_manager_id': self.primary_manager_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Zone(db.Model):
    __tablename__ = 'zones'
    
    # UUID Primary Key DEFAULT gen_random_uuid()
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    site_id = db.Column(db.String(36), db.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    zone_name = db.Column(db.String(100), nullable=False)  # e.g., "OPD", "ICU 3rd Floor", "Food Court"
    tenant_id = db.Column(db.String(36), nullable=False, index=True)
    floor = db.Column(db.String(30), nullable=True)
    department = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'site_id': str(self.site_id),
            'zone_name': self.zone_name,
            'tenant_id': str(self.tenant_id),
            'floor': self.floor,
            'department': self.department,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Engagement(db.Model):
    """
    Separates Person (Worker's Master Identity) from Deployment (Site).
    Prevents overlapping shift deployments at the same site.
    """
    __tablename__ = 'engagements'
    
    # UUID Primary Key DEFAULT gen_random_uuid()
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = db.Column(db.String(36), nullable=False, index=True)  # Worker's Master Identity (UUID)
    site_id = db.Column(db.String(36), db.ForeignKey('sites.id', ondelete='SET NULL'), nullable=True, index=True)
    duty_type = db.Column(db.String(50), default='FIXED', nullable=True)  # "FIXED", "RELIEVER"
    shift_code = db.Column(db.String(50), default='7-3 (Morning)', nullable=True)  # "7-3 (Morning)", "3-11 (Evening)"
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    tenant_id = db.Column(db.String(36), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': str(self.id),
            'person_id': str(self.person_id),
            'site_id': str(self.site_id) if self.site_id else None,
            'duty_type': self.duty_type,
            'shift_code': self.shift_code,
            'is_active': self.is_active,
            'tenant_id': str(self.tenant_id),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class RosterEntry(db.Model):
    __tablename__ = 'roster_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=False, index=True)
    site_id = db.Column(db.String(50), db.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    engagement_id = db.Column(db.Integer, db.ForeignKey('engagements.id', ondelete='SET NULL'), nullable=True)
    person_id = db.Column(db.String(50), nullable=False, index=True)
    calendar_date = db.Column(db.Date, nullable=False, index=True)
    shift_name = db.Column(db.String(20), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    assigned_by = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'site_id': self.site_id,
            'engagement_id': self.engagement_id,
            'person_id': self.person_id,
            'calendar_date': self.calendar_date.isoformat() if self.calendar_date else None,
            'shift_name': self.shift_name,
            'department': self.department,
            'assigned_by': self.assigned_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AttendanceEvent(db.Model):
    __tablename__ = 'attendance_events'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=False, index=True)
    site_id = db.Column(db.String(50), db.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    person_id = db.Column(db.String(50), nullable=False, index=True)
    event_type = db.Column(db.String(20), nullable=False)  # 'PUNCH_IN', 'PUNCH_OUT'
    timestamp = db.Column(db.DateTime, nullable=False, index=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    distance_meters = db.Column(db.Float, nullable=True)
    is_verified = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'site_id': self.site_id,
            'person_id': self.person_id,
            'event_type': self.event_type,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'lat': self.lat,
            'lng': self.lng,
            'distance_meters': self.distance_meters,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.String(50), primary_key=True)
    tenant_id = db.Column(db.String(100), nullable=False, index=True)
    site_id = db.Column(db.String(50), db.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    person_id = db.Column(db.String(50), nullable=False, index=True)
    document_type = db.Column(db.String(50), nullable=False)
    file_url = db.Column(db.Text, nullable=False)
    file_name = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(30), default='PENDING', nullable=False)
    verified_by = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'site_id': self.site_id,
            'person_id': self.person_id,
            'document_type': self.document_type,
            'file_url': self.file_url,
            'file_name': self.file_name,
            'status': self.status,
            'verified_by': self.verified_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

