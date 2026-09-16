/**
 * Hospital GPS Geofencing Utility
 * 
 * Center Point: Mumbai Hospital (19.0760° N, 72.8777° E)
 * Allowed Boundary Radius: 100.0 Meters
 * Formula: Haversine distance algorithm on Earth Sphere (R = 6,371,000 meters)
 */

export const HOSPITAL_LAT = 19.0760; // Example: Mumbai Hospital Latitude
export const HOSPITAL_LNG = 72.8777; // Example: Mumbai Hospital Longitude
export const MAX_ALLOWED_RADIUS_METERS = 100.0; // 100 Meters Boundary
export const HOSPITAL_NAME = 'ApexCare Hospital (Mumbai)';

/**
 * Calculate great-circle distance between two points in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000.0; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2.0) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2.0) ** 2;
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

  return R * c;
}

/**
 * Verify user coordinate against hospital geofence
 * Returns [boolean, number] matching:
 * def verify_hospital_geofence(user_lat, user_lng):
 *     distance = calculate_distance_meters(HOSPITAL_LAT, HOSPITAL_LNG, user_lat, user_lng)
 *     if distance <= MAX_ALLOWED_RADIUS_METERS:
 *         return True, round(distance, 2)
 *     return False, round(distance, 2)
 */
export function verifyHospitalGeofenceTuple(
  userLat: number,
  userLng: number
): [boolean, number] {
  const distance = calculateDistanceMeters(HOSPITAL_LAT, HOSPITAL_LNG, userLat, userLng);
  const roundedDistance = Math.round(distance * 100) / 100;
  if (roundedDistance <= MAX_ALLOWED_RADIUS_METERS) {
    return [true, roundedDistance];
  }
  return [false, roundedDistance];
}

export interface GeofenceVerificationResult {
  allowed: boolean;
  distanceMeters: number;
  maxAllowedRadius: number;
  hospitalCoords: { lat: number; lng: number };
  userCoords: { lat: number; lng: number };
  status: 'INSIDE_GEOFENCE' | 'OUTSIDE_GEOFENCE';
  message: string;
  maxRadiusMeters?: number;
  reason?: string;
}

export function verifyHospitalGeofence(
  userLat: number,
  userLng: number
): GeofenceVerificationResult {
  const [allowed, distanceMeters] = verifyHospitalGeofenceTuple(userLat, userLng);
  return {
    allowed,
    distanceMeters,
    maxAllowedRadius: MAX_ALLOWED_RADIUS_METERS,
    maxRadiusMeters: MAX_ALLOWED_RADIUS_METERS,
    hospitalCoords: { lat: HOSPITAL_LAT, lng: HOSPITAL_LNG },
    userCoords: { lat: userLat, lng: userLng },
    status: allowed ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    message: allowed
      ? `Within perimeter: ${distanceMeters.toFixed(1)}m from hospital center (Max ${MAX_ALLOWED_RADIUS_METERS}m).`
      : `Geofence violation: You are ${distanceMeters.toFixed(1)}m away from hospital center (Max allowed: ${MAX_ALLOWED_RADIUS_METERS}m).`,
    reason: allowed ? 'Within 100m geofence perimeter' : 'Outside 100m geofence perimeter',
  };
}

export const GPS_OFF_ALERT_MESSAGE =
  "Please turn ON your phone's GPS / Location toggle from settings to complete Punch In.";

/**
 * Standard W3C PositionError / GeolocationPositionError error codes
 */
export const PositionErrorCodes = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

/**
 * Custom Error for GPS Hardware and Timeout states
 */
export class GpsHardwareError extends Error {
  code: number;
  isGpsOff: boolean;
  errorType: 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'PERMISSION_DENIED' | 'UNSUPPORTED' | 'UNKNOWN';

  constructor(
    message: string,
    code: number,
    errorType: 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'PERMISSION_DENIED' | 'UNSUPPORTED' | 'UNKNOWN',
    isGpsOff = false
  ) {
    super(message);
    this.name = 'GpsHardwareError';
    this.code = code;
    this.errorType = errorType;
    this.isGpsOff = isGpsOff;
  }
}

/**
 * Real device Geolocation capture promise
 * 1. Set a 5-second timeout on navigator.geolocation.getCurrentPosition
 * 2. Catch PositionError.POSITION_UNAVAILABLE and PositionError.TIMEOUT errors
 * 3. If device GPS is turned OFF, reject with clear alert:
 *    "Please turn ON your phone's GPS / Location toggle from settings to complete Punch In."
 */
export function getDeviceCoordinates(timeoutMs = 5000): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator || !navigator.geolocation) {
      reject(
        new GpsHardwareError(
          'Geolocation is not supported by your browser or environment.',
          0,
          'UNSUPPORTED',
          false
        )
      );
      return;
    }

    // 1. Set a 5-second timeout on navigator.geolocation.getCurrentPosition
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error: GeolocationPositionError) => {
        // 2. Catch PositionError.POSITION_UNAVAILABLE and PositionError.TIMEOUT errors
        const isPositionUnavailable =
          error.code === error.POSITION_UNAVAILABLE ||
          error.code === PositionErrorCodes.POSITION_UNAVAILABLE ||
          error.code === (window as any).PositionError?.POSITION_UNAVAILABLE ||
          error.code === 2;

        const isTimeout =
          error.code === error.TIMEOUT ||
          error.code === PositionErrorCodes.TIMEOUT ||
          error.code === (window as any).PositionError?.TIMEOUT ||
          error.code === 3;

        const isPermissionDenied =
          error.code === error.PERMISSION_DENIED ||
          error.code === PositionErrorCodes.PERMISSION_DENIED ||
          error.code === (window as any).PositionError?.PERMISSION_DENIED ||
          error.code === 1;

        // 3. If device GPS is turned OFF, immediately surface clear alert:
        // "Please turn ON your phone's GPS / Location toggle from settings to complete Punch In."
        if (isPositionUnavailable || isTimeout) {
          reject(
            new GpsHardwareError(
              GPS_OFF_ALERT_MESSAGE,
              error.code,
              isPositionUnavailable ? 'POSITION_UNAVAILABLE' : 'TIMEOUT',
              true // isGpsOff = true
            )
          );
          return;
        }

        if (isPermissionDenied) {
          reject(
            new GpsHardwareError(
              'Location access denied. Please grant location permissions in your browser or phone settings.',
              error.code,
              'PERMISSION_DENIED',
              false
            )
          );
          return;
        }

        reject(
          new GpsHardwareError(
            error.message || 'Unable to retrieve location.',
            error.code || 0,
            'UNKNOWN',
            false
          )
        );
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs, // Strictly 5000ms timeout
        maximumAge: 0,
      }
    );
  });
}

/**
 * Coordinate Presets for simulation/testing in browser & preview containers
 */
export interface LocationPreset {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  expectedInside: boolean;
}

export const GEOFENCE_PRESETS: LocationPreset[] = [
  {
    id: 'hospital_center',
    name: 'Hospital Center Point (Direct)',
    description: 'Exact center of Mumbai hospital campus',
    lat: 19.0760,
    lng: 72.8777,
    expectedInside: true,
  },
  {
    id: 'main_entrance',
    name: 'Main Hospital Entrance Gate (~18m)',
    description: 'Front lobby & emergency drop-off',
    lat: 19.07612,
    lng: 72.87778,
    expectedInside: true,
  },
  {
    id: 'housekeeping_hub',
    name: 'Housekeeping Base Hub (~45m)',
    description: 'Ground floor linen store & locker area',
    lat: 19.07632,
    lng: 72.87795,
    expectedInside: true,
  },
  {
    id: 'perimeter_gate',
    name: 'Perimeter Boundary Gate (~88m)',
    description: 'Near the outer 100m security fence',
    lat: 19.07662,
    lng: 72.87815,
    expectedInside: true,
  },
  {
    id: 'outside_street',
    name: 'Outside Street / Bus Stop (~220m)',
    description: 'Outside 100m zone (Should BLOCK punch-in)',
    lat: 19.07780,
    lng: 72.87850,
    expectedInside: false,
  },
  {
    id: 'remote_residence',
    name: 'Remote Off-Site Residence (~1.8km)',
    description: 'Staff home / remote area (Should BLOCK punch-in)',
    lat: 19.09000,
    lng: 72.88500,
    expectedInside: false,
  },
  {
    id: 'gps_turned_off',
    name: 'Hardware Check: Device GPS OFF',
    description: 'Simulates PositionError.POSITION_UNAVAILABLE or TIMEOUT',
    lat: 0,
    lng: 0,
    expectedInside: false,
  },
];

const GEOFENCE_STORAGE_KEY = 'apexcare_geofence_mode';

export interface StoredGeofenceConfig {
  mode: 'DEVICE_GPS' | 'SIMULATED';
  simulatedPresetId: string;
  customLat?: number;
  customLng?: number;
}

export function getStoredGeofenceConfig(): StoredGeofenceConfig {
  try {
    const raw = localStorage.getItem(GEOFENCE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    mode: 'SIMULATED',
    simulatedPresetId: 'main_entrance', // Default inside hospital for smooth demo
  };
}

export function saveStoredGeofenceConfig(cfg: StoredGeofenceConfig): void {
  try {
    localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent('geofence-config-updated', { detail: cfg }));
  } catch {}
}

/**
 * Returns currently active coordinates from stored preset or custom coordinates
 */
export function getCurrentGeofenceCoords(): { lat: number; lng: number } {
  const cfg = getStoredGeofenceConfig();
  if (cfg.customLat !== undefined && cfg.customLng !== undefined) {
    return { lat: cfg.customLat, lng: cfg.customLng };
  }
  const preset = GEOFENCE_PRESETS.find((p) => p.id === cfg.simulatedPresetId) || GEOFENCE_PRESETS[1];
  return { lat: preset.lat, lng: preset.lng };
}

export interface PunchLocationResult {
  allowed: boolean;
  userCoords: { lat: number; lng: number };
  distanceMeters: number;
  maxRadiusMeters: number;
  accuracy?: number;
  isGps: boolean;
  reason?: string;
  source: 'DEVICE_GPS' | 'SIMULATED_PRESET' | 'FALLBACK';
  isGpsOff?: boolean;
  gpsErrorCode?: number;
  gpsErrorMessage?: string;
}

/**
 * Explicit GPS location acquisition triggered strictly when the user clicks 'Punch In' or 'Punch Out'.
 * Sets a 5-second timeout on navigator.geolocation.getCurrentPosition.
 * Catches PositionError.POSITION_UNAVAILABLE and PositionError.TIMEOUT errors.
 * If device GPS is turned OFF, surfaces alert: "Please turn ON your phone's GPS / Location toggle from settings to complete Punch In."
 */
export async function requestLocationOnPunch(punchType: 'IN' | 'OUT' = 'IN'): Promise<PunchLocationResult> {
  const cfg = getStoredGeofenceConfig();

  // Test simulation for hardware check
  if (cfg.mode === 'SIMULATED' && cfg.simulatedPresetId === 'gps_turned_off') {
    return {
      allowed: false,
      userCoords: { lat: 0, lng: 0 },
      distanceMeters: 999999,
      maxRadiusMeters: MAX_ALLOWED_RADIUS_METERS,
      isGps: false,
      isGpsOff: true,
      gpsErrorCode: PositionErrorCodes.POSITION_UNAVAILABLE,
      gpsErrorMessage: GPS_OFF_ALERT_MESSAGE,
      reason: GPS_OFF_ALERT_MESSAGE,
      source: 'DEVICE_GPS',
    };
  }

  // If running in browser and geolocation is supported, request live coordinates on the button click
  if (typeof window !== 'undefined' && navigator && navigator.geolocation) {
    try {
      // 1. 5-second timeout on navigator.geolocation.getCurrentPosition
      const pos = await getDeviceCoordinates(5000);
      const verification = verifyHospitalGeofence(pos.latitude, pos.longitude);

      // Save verified coords so status cards and logs reflect real device position
      saveStoredGeofenceConfig({
        ...cfg,
        mode: 'DEVICE_GPS',
        customLat: pos.latitude,
        customLng: pos.longitude,
      });

      // Notify any mounted Geofence cards about real coordinates
      window.dispatchEvent(
        new CustomEvent('geofence-location-acquired', {
          detail: {
            lat: pos.latitude,
            lng: pos.longitude,
            accuracy: pos.accuracy,
            source: 'DEVICE_GPS',
          },
        })
      );

      return {
        allowed: verification.allowed,
        userCoords: { lat: pos.latitude, lng: pos.longitude },
        distanceMeters: verification.distanceMeters,
        maxRadiusMeters: verification.maxRadiusMeters,
        accuracy: pos.accuracy,
        isGps: true,
        isGpsOff: false,
        reason: verification.reason,
        source: 'DEVICE_GPS',
      };
    } catch (err: any) {
      console.warn('GPS location request on punch error / hardware check:', err);

      // 2. Catch PositionError.POSITION_UNAVAILABLE and PositionError.TIMEOUT
      // 3. If device GPS is turned OFF, immediately flag isGpsOff and set the required alert
      const isUnavailableOrTimeout =
        err?.isGpsOff ||
        err?.code === PositionErrorCodes.POSITION_UNAVAILABLE ||
        err?.code === PositionErrorCodes.TIMEOUT ||
        err?.code === 2 ||
        err?.code === 3 ||
        err?.message === GPS_OFF_ALERT_MESSAGE;

      if (isUnavailableOrTimeout) {
        return {
          allowed: false,
          userCoords: { lat: 0, lng: 0 },
          distanceMeters: 999999,
          maxRadiusMeters: MAX_ALLOWED_RADIUS_METERS,
          isGps: false,
          isGpsOff: true,
          gpsErrorCode: err?.code || PositionErrorCodes.POSITION_UNAVAILABLE,
          gpsErrorMessage: GPS_OFF_ALERT_MESSAGE,
          reason: GPS_OFF_ALERT_MESSAGE,
          source: 'DEVICE_GPS',
        };
      }

      // If user specifically has an active simulated preset in demo controls (e.g. main entrance)
      if (cfg.mode === 'SIMULATED') {
        const current = getCurrentGeofenceCoords();
        const verification = verifyHospitalGeofence(current.lat, current.lng);
        return {
          allowed: verification.allowed,
          userCoords: current,
          distanceMeters: verification.distanceMeters,
          maxRadiusMeters: verification.maxRadiusMeters,
          isGps: false,
          isGpsOff: false,
          reason: verification.reason,
          source: 'SIMULATED_PRESET',
        };
      }

      // Other errors (e.g. permission denied)
      return {
        allowed: false,
        userCoords: { lat: 0, lng: 0 },
        distanceMeters: 999999,
        maxRadiusMeters: MAX_ALLOWED_RADIUS_METERS,
        isGps: false,
        isGpsOff: false,
        gpsErrorCode: err?.code,
        gpsErrorMessage: err?.message || 'Location access denied.',
        reason: err?.message || 'Location access denied. Please grant location permissions in browser settings.',
        source: 'FALLBACK',
      };
    }
  }

  // Fallback if browser does not support geolocation
  return {
    allowed: false,
    userCoords: { lat: 0, lng: 0 },
    distanceMeters: 999999,
    maxRadiusMeters: MAX_ALLOWED_RADIUS_METERS,
    isGps: false,
    isGpsOff: true,
    gpsErrorMessage: GPS_OFF_ALERT_MESSAGE,
    reason: GPS_OFF_ALERT_MESSAGE,
    source: 'FALLBACK',
  };
}

/**
 * Backward compatible alias for requestLocationOnPunch
 */
export async function acquireAndVerifyPunchLocation(): Promise<GeofenceVerificationResult> {
  const res = await requestLocationOnPunch();
  return {
    allowed: res.allowed,
    distanceMeters: res.distanceMeters,
    maxAllowedRadius: res.maxRadiusMeters,
    maxRadiusMeters: res.maxRadiusMeters,
    hospitalCoords: { lat: HOSPITAL_LAT, lng: HOSPITAL_LNG },
    userCoords: res.userCoords,
    status: res.allowed ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    message: res.reason || (res.allowed ? 'Within geofence' : 'Outside geofence'),
    reason: res.reason,
  };
}
