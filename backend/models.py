from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
try:
    from .geofence import verify_hospital_geofence, calculate_distance_meters, HOSPITAL_LAT, HOSPITAL_LNG, MAX_ALLOWED_RADIUS_METERS
except ImportError:
    from geofence import verify_hospital_geofence, calculate_distance_meters, HOSPITAL_LAT, HOSPITAL_LNG, MAX_ALLOWED_RADIUS_METERS

db = SQLAlchemy()

# 1. User Account Model (Complete Hierarchy & Admin Vault)
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
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
    requested_by = db.Column(db.String(50), nullable=True, index=True)  # Supervisor Staff ID
    candidate_name = db.Column(db.String(100), nullable=False)
    proposed_area = db.Column(db.String(50), nullable=True)
    proposed_shift = db.Column(db.String(20), default='7-3', nullable=True)
    status = db.Column(db.String(20), default='PENDING', nullable=False)  # 'PENDING', 'APPROVED', 'REJECTED'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
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
            'staff_id': self.staff_id,
            'date': self.date.isoformat() if self.date else None,
            'assigned_department': self.assigned_department,
            'assigned_by_supervisor': self.assigned_by_supervisor,
            'ot_requested_hours': self.ot_requested_hours,
            'ot_status': self.ot_status,
            'approved_by': self.approved_by,
        }

