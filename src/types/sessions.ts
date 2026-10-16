export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface UserSession {
  session_id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  device_name: string; // e.g. "Oppo F31 Pro / Android 15 / Chrome", "Windows 11 / Chrome"
  device_type: DeviceType;
  browser: string; // e.g. "Chrome", "Safari", "Firefox", "Edge"
  os: string; // e.g. "Android 15", "Windows 11", "iOS 17", "macOS"
  ip_address: string; // Real IP address extracted from connection
  location: string; // Real location detected from IP geolocation (City, State, Country)
  created_at: string;
  last_active_at: string;
  is_active: boolean;
  is_current?: boolean;
}
