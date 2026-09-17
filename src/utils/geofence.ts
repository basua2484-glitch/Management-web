/**
 * Hospital GPS Geofencing Security Utility - Production Real-Time Engine
 * 
 * Center Point: ApexCare Hospital Mumbai (Lat: 19.0760° N, Lng: 72.8777° E)
 * Allowed Boundary Radius: 100.0 Meters
 * Formula: Haversine great-circle distance algorithm on Earth Sphere (R = 6,371,000 meters)
 * Enforcement: Strictly locked to live browser coordinates against actual hospital parameters.
 */

import type { GeofenceConfig, WardZoneGeofence } from '../types';

export const DEFAULT_HOSPITAL_LAT = 19.0760; // Production Hospital Latitude
export const DEFAULT_HOSPITAL_LNG = 72.8777; // Production Hospital Longitude
export const DEFAULT_MAX_ALLOWED_RADIUS_METERS = 100.0; // Strict 100 Meters Boundary
export const DEFAULT_HOSPITAL_NAME = 'ApexCare Hospital (Mumbai)';

export const DEFAULT_WARD_ZONES: WardZoneGeofence[] = [
  {
    id: 'zone-icu',
    name: 'ICU & Operation Theatres',
    radiusMeters: 50,
    enabled: true,
    description: 'High-security sterile critical care zone (Tight 50m perimeter)',
  },
  {
    id: 'zone-emergency',
    name: 'Emergency & Trauma Center',
    radiusMeters: 60,
    enabled: true,
    description: 'Rapid ambulance entry and triage bays (60m perimeter)',
  },
  {
    id: 'zone-general-wards',
    name: 'General Inpatient Wards (1st - 5th Floor)',
    radiusMeters: 100,
    enabled: true,
    description: 'Standard inpatient housekeeping coverage (100m perimeter)',
  },
  {
    id: 'zone-opd',
    name: 'OPD & Diagnostic Center',
    radiusMeters: 120,
    enabled: true,
    description: 'Outpatient consultation & pathology wing (120m perimeter)',
  },
  {
    id: 'zone-admin',
    name: 'Administrative & Services Block',
    radiusMeters: 150,
    enabled: true,
    description: 'Administrative offices, cafeteria & central store (150m perimeter)',
  },
];

export const DEFAULT_GEOFENCE_CONFIG: GeofenceConfig = {
  hospitalName: DEFAULT_HOSPITAL_NAME,
  hospitalLat: DEFAULT_HOSPITAL_LAT,
  hospitalLng: DEFAULT_HOSPITAL_LNG,
  maxAllowedRadiusMeters: DEFAULT_MAX_ALLOWED_RADIUS_METERS,
  requireHighAccuracyGps: true,
  gpsTimeoutSeconds: 5,
  zones: DEFAULT_WARD_ZONES,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default',
};

// Backward-compatible static constants referencing defaults
export const HOSPITAL_LAT = DEFAULT_HOSPITAL_LAT;
export const HOSPITAL_LNG = DEFAULT_HOSPITAL_LNG;
export const MAX_ALLOWED_RADIUS_METERS = DEFAULT_MAX_ALLOWED_RADIUS_METERS;
export const HOSPITAL_NAME = DEFAULT_HOSPITAL_NAME;

/**
 * Synchronous getter for current active Geofence Configuration
 */
export function getStoredGeofenceConfig(): GeofenceConfig {
  if (typeof window === 'undefined') return DEFAULT_GEOFENCE_CONFIG;
  try {
    const raw = localStorage.getItem('apexcare_geofence_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.hospitalLat === 'number' && typeof parsed.hospitalLng === 'number') {
        return {
          ...DEFAULT_GEOFENCE_CONFIG,
          ...parsed,
          zones: Array.isArray(parsed.zones) && parsed.zones.length > 0 ? parsed.zones : DEFAULT_WARD_ZONES,
        };
      }
    }
  } catch (err) {
    console.warn('Error reading stored geofence config:', err);
  }
  return DEFAULT_GEOFENCE_CONFIG;
}

/**
 * Synchronous saver for Geofence Configuration with notification event
 */
export function saveStoredGeofenceConfig(config: GeofenceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('apexcare_geofence_config', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('geofence-config-updated', { detail: config }));
  } catch (err) {
    console.warn('Error saving stored geofence config:', err);
  }
}

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
 * Verify user coordinate against dynamic hospital geofence
 * Returns [boolean, number] tuple
 */
export function verifyHospitalGeofenceTuple(
  userLat: number,
  userLng: number,
  wardOrDept?: string
): [boolean, number] {
  const result = verifyHospitalGeofence(userLat, userLng, wardOrDept);
  return [result.allowed, result.distanceMeters];
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
  matchedZoneName?: string;
}

/**
 * Dynamically verify coordinate against Admin-configured hospital center and radius tolerances
 */
export function verifyHospitalGeofence(
  userLat: number,
  userLng: number,
  wardOrDept?: string,
  configOverride?: GeofenceConfig
): GeofenceVerificationResult {
  const config = configOverride || getStoredGeofenceConfig();

  let activeRadius = Number(config.maxAllowedRadiusMeters) || DEFAULT_MAX_ALLOWED_RADIUS_METERS;
  let centerLat = Number(config.hospitalLat) || DEFAULT_HOSPITAL_LAT;
  let centerLng = Number(config.hospitalLng) || DEFAULT_HOSPITAL_LNG;
  let matchedZone: WardZoneGeofence | undefined;

  // Custom boundary radius per specific Ward / Zone if configured & matched
  if (wardOrDept && Array.isArray(config.zones) && config.zones.length > 0) {
    const cleanQuery = wardOrDept.trim().toLowerCase();
    matchedZone = config.zones.find(
      (z) =>
        z.enabled &&
        (z.name.toLowerCase().includes(cleanQuery) ||
          cleanQuery.includes(z.name.toLowerCase()) ||
          z.id.toLowerCase() === cleanQuery)
    );
    if (matchedZone) {
      activeRadius = matchedZone.radiusMeters;
      if (typeof matchedZone.customLat === 'number' && typeof matchedZone.customLng === 'number') {
        centerLat = matchedZone.customLat;
        centerLng = matchedZone.customLng;
      }
    }
  }

  const distance = calculateDistanceMeters(centerLat, centerLng, userLat, userLng);
  const roundedDistance = Math.round(distance * 100) / 100;
  const allowed = roundedDistance <= activeRadius;

  const zonePrefix = matchedZone ? `[Zone: ${matchedZone.name}] ` : '';

  return {
    allowed,
    distanceMeters: roundedDistance,
    maxAllowedRadius: activeRadius,
    maxRadiusMeters: activeRadius,
    hospitalCoords: { lat: centerLat, lng: centerLng },
    userCoords: { lat: userLat, lng: userLng },
    status: allowed ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    matchedZoneName: matchedZone?.name,
    message: allowed
      ? `${zonePrefix}Within perimeter: ${roundedDistance.toFixed(1)}m from center (Allowed max ${activeRadius}m).`
      : `${zonePrefix}Geofence violation: You are ${roundedDistance.toFixed(1)}m away from center (Allowed max ${activeRadius}m).`,
    reason: allowed
      ? `${zonePrefix}Within ${activeRadius}m perimeter`
      : `${zonePrefix}Outside ${activeRadius}m perimeter (${roundedDistance.toFixed(1)}m away)`,
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
 * Real device Geolocation capture promise with strict 5-second timeout
 * Catch PositionError.POSITION_UNAVAILABLE and PositionError.TIMEOUT errors
 */
export function getDeviceCoordinates(timeoutMs = 5000): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator || !navigator.geolocation) {
      reject(
        new GpsHardwareError(
          'Geolocation is not supported by your browser.',
          0,
          'UNSUPPORTED',
          false
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === PositionErrorCodes.PERMISSION_DENIED) {
          reject(
            new GpsHardwareError(
              'Location permission was denied. Please allow location access in your browser settings to verify hospital attendance.',
              error.code,
              'PERMISSION_DENIED',
              false
            )
          );
          return;
        }

        if (error.code === PositionErrorCodes.POSITION_UNAVAILABLE) {
          reject(
            new GpsHardwareError(
              GPS_OFF_ALERT_MESSAGE,
              error.code,
              'POSITION_UNAVAILABLE',
              true
            )
          );
          return;
        }

        if (error.code === PositionErrorCodes.TIMEOUT) {
          reject(
            new GpsHardwareError(
              GPS_OFF_ALERT_MESSAGE,
              error.code,
              'TIMEOUT',
              true
            )
          );
          return;
        }

        reject(
          new GpsHardwareError(
            error.message || 'Unable to retrieve real GPS location.',
            error.code || 0,
            'UNKNOWN',
            false
          )
        );
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

export interface PunchLocationResult {
  allowed: boolean;
  userCoords: { lat: number; lng: number };
  distanceMeters: number;
  maxRadiusMeters: number;
  accuracy?: number;
  isGps: boolean;
  reason?: string;
  source: 'DEVICE_GPS' | 'FALLBACK';
  isGpsOff?: boolean;
  gpsErrorCode?: number;
  gpsErrorMessage?: string;
  matchedZoneName?: string;
}

/**
 * Strict GPS location acquisition triggered ONLY when the user clicks 'Punch In' or 'Punch Out'.
 * Sets a 5-second timeout on navigator.geolocation.getCurrentPosition.
 * Never falls back to mock coordinates or hospital center.
 */
export async function requestLocationOnPunch(
  punchType: 'IN' | 'OUT' = 'IN',
  wardOrDept?: string
): Promise<PunchLocationResult> {
  const config = getStoredGeofenceConfig();
  const alertMsg =
    punchType === 'OUT'
      ? "Please turn ON your phone's GPS / Location toggle from settings to complete Punch Out."
      : "Please turn ON your phone's GPS / Location toggle from settings to complete Punch In.";

  if (typeof window !== 'undefined' && navigator && navigator.geolocation) {
    try {
      const pos = await getDeviceCoordinates(config.gpsTimeoutSeconds * 1000 || 5000);
      const verification = verifyHospitalGeofence(pos.latitude, pos.longitude, wardOrDept, config);

      // Notify any mounted Geofence cards about real coordinates
      window.dispatchEvent(
        new CustomEvent('geofence-location-acquired', {
          detail: {
            lat: pos.latitude,
            lng: pos.longitude,
            accuracy: pos.accuracy,
            source: 'DEVICE_GPS',
            matchedZoneName: verification.matchedZoneName,
          },
        })
      );

      return {
        allowed: verification.allowed,
        userCoords: { lat: pos.latitude, lng: pos.longitude },
        distanceMeters: verification.distanceMeters,
        maxRadiusMeters: verification.maxRadiusMeters || config.maxAllowedRadiusMeters,
        accuracy: pos.accuracy,
        isGps: true,
        isGpsOff: false,
        reason: verification.reason,
        matchedZoneName: verification.matchedZoneName,
        source: 'DEVICE_GPS',
      };
    } catch (err: any) {
      console.warn('GPS location request on punch error:', err);

      const isUnavailableOrTimeout =
        err?.isGpsOff ||
        err?.code === PositionErrorCodes.POSITION_UNAVAILABLE ||
        err?.code === PositionErrorCodes.TIMEOUT ||
        err?.code === 2 ||
        err?.code === 3 ||
        err?.message === GPS_OFF_ALERT_MESSAGE ||
        err?.message?.includes('GPS / Location toggle');

      if (isUnavailableOrTimeout) {
        return {
          allowed: false,
          userCoords: { lat: 0, lng: 0 },
          distanceMeters: 999999,
          maxRadiusMeters: config.maxAllowedRadiusMeters,
          isGps: false,
          isGpsOff: true,
          gpsErrorCode: err?.code || PositionErrorCodes.POSITION_UNAVAILABLE,
          gpsErrorMessage: alertMsg,
          reason: alertMsg,
          source: 'DEVICE_GPS',
        };
      }

      // Permission denied or other hardware failure
      return {
        allowed: false,
        userCoords: { lat: 0, lng: 0 },
        distanceMeters: 999999,
        maxRadiusMeters: config.maxAllowedRadiusMeters,
        isGps: false,
        isGpsOff: false,
        gpsErrorCode: err?.code,
        gpsErrorMessage: err?.message || 'Location access denied.',
        reason: err?.message || 'Location access denied. Please grant location permissions in browser settings.',
        source: 'FALLBACK',
      };
    }
  }

  // Geolocation not supported
  return {
    allowed: false,
    userCoords: { lat: 0, lng: 0 },
    distanceMeters: 999999,
    maxRadiusMeters: config.maxAllowedRadiusMeters,
    isGps: false,
    isGpsOff: true,
    gpsErrorMessage: alertMsg,
    reason: alertMsg,
    source: 'FALLBACK',
  };
}

/**
 * Backward compatible alias for requestLocationOnPunch
 */
export async function acquireAndVerifyPunchLocation(wardOrDept?: string): Promise<GeofenceVerificationResult> {
  const res = await requestLocationOnPunch('IN', wardOrDept);
  const config = getStoredGeofenceConfig();
  return {
    allowed: res.allowed,
    distanceMeters: res.distanceMeters,
    maxAllowedRadius: res.maxRadiusMeters,
    maxRadiusMeters: res.maxRadiusMeters,
    hospitalCoords: { lat: config.hospitalLat, lng: config.hospitalLng },
    userCoords: res.userCoords,
    status: res.allowed ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    message: res.reason || (res.allowed ? 'Within geofence' : 'Outside geofence'),
    reason: res.reason,
    matchedZoneName: res.matchedZoneName,
  };
}
