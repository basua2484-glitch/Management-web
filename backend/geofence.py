import math

# Hospital Center Point & Allowed Radius (in Meters)
HOSPITAL_LAT = 19.0760   # Example: Mumbai Hospital Latitude
HOSPITAL_LNG = 72.8777   # Example: Mumbai Hospital Longitude
MAX_ALLOWED_RADIUS_METERS = 100.0  # 100 Meters Boundary

def calculate_distance_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0 # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def verify_hospital_geofence(user_lat, user_lng):
    distance = calculate_distance_meters(HOSPITAL_LAT, HOSPITAL_LNG, user_lat, user_lng)
    if distance <= MAX_ALLOWED_RADIUS_METERS:
        return True, round(distance, 2)
    return False, round(distance, 2)
