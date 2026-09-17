import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sliders,
  Layers,
  Crosshair,
  Lock,
  Sparkles,
} from 'lucide-react';
import type { GeofenceConfig, WardZoneGeofence } from '../types';
import {
  DEFAULT_GEOFENCE_CONFIG,
  DEFAULT_WARD_ZONES,
  DEFAULT_HOSPITAL_LAT,
  DEFAULT_HOSPITAL_LNG,
  DEFAULT_MAX_ALLOWED_RADIUS_METERS,
  calculateDistanceMeters,
  getStoredGeofenceConfig,
  verifyHospitalGeofence,
  getDeviceCoordinates,
} from '../utils/geofence';
import {
  fetchLiveGeofenceSettings,
  updateGeofenceSettings,
  subscribeToGeofenceSettings,
} from '../services/firestoreService';

interface GeofenceSettingsPanelProps {
  currentUsername?: string;
  onSavedNotification?: (msg: string) => void;
}

export const GeofenceSettingsPanel: React.FC<GeofenceSettingsPanelProps> = ({
  currentUsername = 'Admin',
  onSavedNotification,
}) => {
  const [config, setConfig] = useState<GeofenceConfig>(() => getStoredGeofenceConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New Zone Form State
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(60);
  const [newZoneDescription, setNewZoneDescription] = useState('');
  const [newZoneCustomLat, setNewZoneCustomLat] = useState<string>('');
  const [newZoneCustomLng, setNewZoneCustomLng] = useState<string>('');

  // GPS Tester for Admin
  const [isTestingGps, setIsTestingGps] = useState(false);
  const [testTargetWard, setTestTargetWard] = useState<string>('global');
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    lat: number;
    lng: number;
    distanceMeters: number;
    allowed: boolean;
    allowedMaxRadius: number;
    accuracy?: number;
    matchedZone?: string;
    message: string;
    testedAt: string;
  } | null>(null);

  // Persistence status tracking
  const [isRecentlySaved, setIsRecentlySaved] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  // Active tester radius derived dynamically from the selected ward or global slider
  const activeTesterRadius =
    testTargetWard === 'global'
      ? Number(config.maxAllowedRadiusMeters)
      : (config.zones.find((z) => z.id === testTargetWard)?.radiusMeters ?? Number(config.maxAllowedRadiusMeters));

  // Load from Live Firestore on mount
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const live = await fetchLiveGeofenceSettings();
        if (isMounted && live) {
          setConfig(live);
        }
      } catch (err) {
        console.warn('Error loading geofence config:', err);
      }
    }
    loadConfig();

    const unsubscribe = subscribeToGeofenceSettings((liveConfig) => {
      if (isMounted) {
        setConfig(liveConfig);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Handle Save with graceful offline fallback and status reset
  const handleSaveSettings = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    setOfflineNotice(null);

    // Coordinate validation
    const lat = Number(config.hospitalLat);
    const lng = Number(config.hospitalLng);
    const radius = Number(config.maxAllowedRadiusMeters);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setSaveError('Latitude must be a valid number between -90 and 90 degrees.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setSaveError('Longitude must be a valid number between -180 and 180 degrees.');
      return;
    }
    if (isNaN(radius) || radius < 10 || radius > 5000) {
      setSaveError('Max allowed radius must be between 10m and 5,000m.');
      return;
    }

    setIsSaving(true);
    try {
      const sanitizedConfig: GeofenceConfig = {
        ...config,
        hospitalLat: lat,
        hospitalLng: lng,
        maxAllowedRadiusMeters: radius,
        gpsTimeoutSeconds: 5, // Strictly enforced 5-second timeout per hospital SOP
        requireHighAccuracyGps: true,
      };

      const result = await updateGeofenceSettings(sanitizedConfig, currentUsername);
      setConfig(sanitizedConfig);

      if (result.success) {
        setIsRecentlySaved(true);
        setTimeout(() => setIsRecentlySaved(false), 4000);

        if (result.isOfflineFallback) {
          const offlineMsg = `Saved to local offline cache: (${lat.toFixed(4)}, ${lng.toFixed(4)}) with ${radius}m perimeter. (Firestore offline - will sync when online)`;
          setSaveSuccess(offlineMsg);
          setOfflineNotice(result.message);
          if (onSavedNotification) onSavedNotification(offlineMsg);
        } else {
          const successMsg = `Geofence settings updated: (${lat.toFixed(4)}, ${lng.toFixed(4)}) with ${radius}m perimeter.`;
          setSaveSuccess(successMsg);
          if (onSavedNotification) onSavedNotification(successMsg);
        }

        setTimeout(() => {
          setSaveSuccess(null);
        }, 5000);
      } else {
        setSaveError(result.message || 'Failed to save geofence configuration to database.');
      }
    } catch (err: any) {
      console.error('Error saving geofence settings:', err);
      setSaveError(err?.message || 'Failed to save geofence configuration to database.');
    } finally {
      setIsSaving(false);
    }
  };

  // Revert to hospital standard defaults
  const handleResetDefaults = () => {
    if (window.confirm('Reset all geofence parameters to ApexCare Hospital standard defaults (19.0760° N, 72.8777° E, 100m)?')) {
      setConfig({
        ...DEFAULT_GEOFENCE_CONFIG,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUsername,
      });
      setSaveSuccess('Reset to defaults. Click "Save Geofence Settings" to persist.');
    }
  };

  // Capture Admin's current device GPS coordinates
  const handleCaptureCurrentLocation = async () => {
    setIsTestingGps(true);
    try {
      const coords = await getDeviceCoordinates(5000);
      setConfig((prev) => ({
        ...prev,
        hospitalLat: Number(coords.latitude.toFixed(6)),
        hospitalLng: Number(coords.longitude.toFixed(6)),
      }));
      setSaveSuccess(`Captured Admin device location: ${coords.latitude.toFixed(5)}°, ${coords.longitude.toFixed(5)}°. Click Save to persist.`);
    } catch (err: any) {
      setSaveError(err?.message || "Please turn ON your phone's GPS / Location toggle from settings to capture coordinates.");
    } finally {
      setIsTestingGps(false);
    }
  };

  // Test current location against configured geofence
  const handleTestCurrentGps = async () => {
    setIsTestingGps(true);
    setTestResult(null);
    try {
      const coords = await getDeviceCoordinates(5000);
      const selectedWard = testTargetWard === 'global' ? undefined : config.zones.find((z) => z.id === testTargetWard)?.name;
      const verification = verifyHospitalGeofence(coords.latitude, coords.longitude, selectedWard, config);
      const dynamicLimit = verification.maxRadiusMeters || verification.maxAllowedRadius || activeTesterRadius;

      setTestResult({
        tested: true,
        lat: coords.latitude,
        lng: coords.longitude,
        distanceMeters: verification.distanceMeters,
        allowed: verification.allowed,
        allowedMaxRadius: dynamicLimit,
        accuracy: coords.accuracy,
        matchedZone: verification.matchedZoneName,
        message: verification.message,
        testedAt: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSaveError(err?.message || "Please turn ON your phone's GPS / Location toggle from settings to complete GPS test.");
    } finally {
      setIsTestingGps(false);
    }
  };

  // Add a new Ward / Zone Boundary
  const handleAddZone = () => {
    if (!newZoneName.trim()) {
      alert('Please enter a name for the Ward / Zone boundary.');
      return;
    }
    const newZone: WardZoneGeofence = {
      id: `zone-${Date.now()}`,
      name: newZoneName.trim(),
      radiusMeters: Number(newZoneRadius) || 60,
      enabled: true,
      description: newZoneDescription.trim() || undefined,
      customLat: newZoneCustomLat.trim() ? Number(newZoneCustomLat) : undefined,
      customLng: newZoneCustomLng.trim() ? Number(newZoneCustomLng) : undefined,
    };

    setConfig((prev) => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));

    setNewZoneName('');
    setNewZoneRadius(60);
    setNewZoneDescription('');
    setNewZoneCustomLat('');
    setNewZoneCustomLng('');
    setIsAddingZone(false);
  };

  // Toggle Zone Enabled
  const handleToggleZone = (zoneId: string) => {
    setConfig((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? { ...z, enabled: !z.enabled } : z)),
    }));
  };

  // Update Zone Radius
  const handleUpdateZoneRadius = (zoneId: string, radius: number) => {
    setConfig((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? { ...z, radiusMeters: Math.max(10, radius) } : z)),
    }));
  };

  // Remove Zone
  const handleDeleteZone = (zoneId: string) => {
    if (window.confirm('Are you sure you want to remove this ward boundary configuration?')) {
      setConfig((prev) => ({
        ...prev,
        zones: prev.zones.filter((z) => z.id !== zoneId),
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 border border-slate-700/80 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Dynamic Geofence &amp; GPS Configuration</h2>
                <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  Live Perimeter Engine
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
                Configure hospital coordinates, default maximum perimeter radius, and customized ward-specific boundaries.
                All Punch In / Out transactions calculate live Haversine distances against these parameters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              type="button"
              id="btn-revert-geofence"
              onClick={handleResetDefaults}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              Reset Defaults
            </button>
            <button
              type="button"
              id="btn-save-geofence-top"
              disabled={isSaving}
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : isRecentlySaved ? 'Saved ✓' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Alerts / Feedback */}
        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{saveSuccess}</span>
          </div>
        )}
        {offlineNotice && (
          <div className="mt-4 p-3 bg-amber-500/20 border border-amber-400/50 rounded-xl text-amber-200 text-xs flex items-center gap-2">
            <Radio className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="font-medium">{offlineNotice}</span>
          </div>
        )}
        {saveError && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-400/50 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span className="font-medium">{saveError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Hospital Center Coordinates & Default Radius */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Hospital Center Coordinates */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Hospital Center Point Coordinates</h3>
              </div>
              <span className="text-3xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                WGS-84 Datum
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Facility Name
                </label>
                <input
                  type="text"
                  value={config.hospitalName}
                  onChange={(e) => setConfig({ ...config, hospitalName: e.target.value })}
                  placeholder="ApexCare Hospital (Mumbai)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude (° N / S)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={config.hospitalLat}
                    onChange={(e) => setConfig({ ...config, hospitalLat: parseFloat(e.target.value) || 0 })}
                    placeholder="19.076000"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                  />
                  <span className="text-3xs text-slate-400 mt-0.5 block font-mono">Range: -90.00 to +90.00</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude (° E / W)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={config.hospitalLng}
                    onChange={(e) => setConfig({ ...config, hospitalLng: parseFloat(e.target.value) || 0 })}
                    placeholder="72.877700"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                  />
                  <span className="text-3xs text-slate-400 mt-0.5 block font-mono">Range: -180.00 to +180.00</span>
                </div>
              </div>

              {/* Quick Coordinate Presets */}
              <div>
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Fast Presets &amp; GPS Capture
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, hospitalLat: 19.076, hospitalLng: 72.8777 })}
                    className="px-2.5 py-1 text-2xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                  >
                    ApexCare Mumbai (19.0760, 72.8777)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, hospitalLat: 18.9894, hospitalLng: 72.8347 })}
                    className="px-2.5 py-1 text-2xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                  >
                    South Pavilion (18.9894, 72.8347)
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureCurrentLocation}
                    disabled={isTestingGps}
                    className="px-2.5 py-1 text-2xs font-bold rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1"
                  >
                    <Crosshair className="h-3 w-3" />
                    {isTestingGps ? 'Detecting...' : 'Detect Device Coordinates'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Maximum Allowed Radius Setting */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Hospital General Perimeter Radius</h3>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {config.maxAllowedRadiusMeters} Meters
              </span>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                The perimeter threshold applied when staff punch in or out without a specific ward override.
                Any punch attempted beyond this Haversine radius will be blocked and recorded in the audit log.
              </p>

              {/* Slider Control */}
              <div>
                <div className="flex justify-between text-2xs font-bold text-slate-400 mb-1">
                  <span>20 Meters (Strict)</span>
                  <span className="text-slate-700 font-mono font-bold">{config.maxAllowedRadiusMeters}m Active</span>
                  <span>500 Meters (Expansive)</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="5"
                  value={config.maxAllowedRadiusMeters}
                  onChange={(e) => setConfig({ ...config, maxAllowedRadiusMeters: parseInt(e.target.value) || 100 })}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Select:</span>
                {[50, 100, 150, 200, 300].map((radiusVal) => (
                  <button
                    key={radiusVal}
                    type="button"
                    onClick={() => setConfig({ ...config, maxAllowedRadiusMeters: radiusVal })}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                      config.maxAllowedRadiusMeters === radiusVal
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {radiusVal}m {radiusVal === 100 ? '(Hospital Standard)' : ''}
                  </button>
                ))}
              </div>

              {/* GPS Enforcement Policies */}
              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    High-Accuracy GPS Acquisition
                  </span>
                  <span className="text-2xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    ENFORCED (Hardware GPS)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-indigo-600" />
                    GPS Hardware Lock Timeout
                  </span>
                  <span className="text-2xs font-mono font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                    5 Seconds Strict
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Ward / Zone Custom Boundaries & Real-Time GPS Tester */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 3: Custom Ward / Zone Boundary Radiuses */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Custom Ward &amp; Zone Boundaries</h3>
              </div>
              <button
                type="button"
                id="btn-add-zone"
                onClick={() => setIsAddingZone(!isAddingZone)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAddingZone ? 'Cancel' : 'Add Zone'}
              </button>
            </div>

            {/* Add Zone Inline Form */}
            {isAddingZone && (
              <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 mb-4 space-y-3">
                <div className="font-bold text-xs text-purple-900">Configure Custom Ward / Zone Geofence</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs font-bold text-slate-600 mb-0.5">Ward / Zone Name</label>
                    <input
                      type="text"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="e.g., Emergency Triage Bay"
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs font-bold text-slate-600 mb-0.5">Custom Radius (Meters)</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={newZoneRadius}
                      onChange={(e) => setNewZoneRadius(parseInt(e.target.value) || 50)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-600 mb-0.5">Description (Optional)</label>
                  <input
                    type="text"
                    value={newZoneDescription}
                    onChange={(e) => setNewZoneDescription(e.target.value)}
                    placeholder="Specific housekeeping boundary for this zone"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingZone(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddZone}
                    className="px-3 py-1 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded shadow-sm"
                  >
                    Add Ward Boundary
                  </button>
                </div>
              </div>
            )}

            {/* List of Configured Zones */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {config.zones.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No custom ward boundaries configured. Default hospital radius ({config.maxAllowedRadiusMeters}m) applies to all areas.
                </div>
              ) : (
                config.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-xl border transition-all ${
                      zone.enabled
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleZone(zone.id)}
                          className={`h-5 w-5 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                            zone.enabled ? 'bg-purple-600 text-white' : 'bg-slate-300 text-slate-600'
                          }`}
                          title={zone.enabled ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                        >
                          {zone.enabled ? '✓' : '—'}
                        </button>
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{zone.name}</span>
                            {!zone.enabled && (
                              <span className="text-3xs uppercase font-bold text-slate-400">(Disabled)</span>
                            )}
                          </div>
                          {zone.description && (
                            <p className="text-3xs text-slate-500 truncate max-w-xs">{zone.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="10"
                            max="500"
                            value={zone.radiusMeters}
                            onChange={(e) => handleUpdateZoneRadius(zone.id, parseInt(e.target.value) || 50)}
                            className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <span className="text-3xs font-bold text-slate-400">m</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteZone(zone.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete boundary"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 4: Real-Time Admin Geofence Tester */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Perimeter Verification Tester</h3>
              </div>
              <span className="text-3xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                Live Device Test
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Test your device's current GPS position right now against the configured hospital center
              ({Number(config.hospitalLat).toFixed(4)}°, {Number(config.hospitalLng).toFixed(4)}°) and radius tolerance
              ({config.maxAllowedRadiusMeters}m) without recording an attendance punch.
            </p>

            <button
              type="button"
              id="btn-test-geofence"
              disabled={isTestingGps}
              onClick={handleTestCurrentGps}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <Crosshair className="h-4 w-4 text-amber-400" />
              {isTestingGps ? 'Testing Live GPS (5s Timeout)...' : 'Test Current Device Location Against Geofence'}
            </button>

            {/* Test Result Display */}
            {testResult && (
              <div
                className={`mt-4 p-4 rounded-xl border transition-all ${
                  testResult.allowed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {testResult.allowed ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {testResult.allowed ? 'PERIMETER CHECK PASSED (ON-PREMISES)' : 'GEOFENCE VIOLATION DETECTED'}
                      </div>
                      <div className="text-xs font-medium mt-0.5">{testResult.message}</div>
                    </div>
                  </div>
                  <span className="text-3xs font-mono text-slate-500">{testResult.testedAt}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-current/10 text-xs font-mono">
                  <div>
                    <span className="text-3xs block uppercase text-slate-500">Calculated Distance</span>
                    <span className="font-bold">{testResult.distanceMeters.toFixed(1)} meters</span>
                  </div>
                  <div>
                    <span className="text-3xs block uppercase text-slate-500">Perimeter Limit</span>
                    <span className="font-bold">{config.maxAllowedRadiusMeters} meters</span>
                  </div>
                  <div>
                    <span className="text-3xs block uppercase text-slate-500">GPS Accuracy</span>
                    <span className="font-bold">±{testResult.accuracy ? testResult.accuracy.toFixed(1) : '5.0'}m</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Save Action Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Last Saved: <span className="font-mono text-slate-800 font-semibold">{config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'System Default'}</span>{' '}
          by <span className="font-semibold text-slate-800">{config.updatedBy || 'Admin'}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-revert-geofence-bottom"
            onClick={handleResetDefaults}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Reset Factory Defaults
          </button>
          <button
            type="button"
            id="btn-save-geofence-bottom"
            disabled={isSaving}
            onClick={handleSaveSettings}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Persisting to Firestore...' : 'Save Geofence Settings to Database'}
          </button>
        </div>
      </div>
    </div>
  );
};
