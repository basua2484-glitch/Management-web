import { UAParser } from 'ua-parser-js';

export interface ParsedDeviceInfo {
  deviceName: string; // e.g. "Oppo F31 Pro / Android 15 / Chrome"
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  brand?: string;
  model?: string;
}

export interface GeoLocationInfo {
  ip: string;
  city: string;
  state: string;
  country: string;
  formattedLocation: string; // e.g. "Mumbai, Maharashtra, India"
}

// In-memory cache for IP Geolocation lookups
const geoCache = new Map<string, GeoLocationInfo>();

/**
 * 1. DYNAMIC USER AGENT PARSING
 * Parses req.headers['user-agent'] or navigator.userAgent to detect exact
 * Device Brand, Model, OS version, and Browser name.
 */
export function parseUserAgentString(uaString?: string): ParsedDeviceInfo {
  const ua = (uaString || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '').trim();
  if (!ua) {
    return {
      deviceName: 'Unknown Device / Web Browser',
      deviceType: 'desktop',
      browser: 'Web Browser',
      os: 'Unknown OS',
    };
  }

  const parser = new UAParser(ua);
  const result = parser.getResult();

  // 1. Browser details
  let rawBrowserName = result.browser.name || 'Browser';
  const cleanBrowserName = rawBrowserName.replace(/Mobile\s+/i, '').replace(/\s+Mobile/i, '').trim();
  const browserVersion = result.browser.version ? result.browser.version.split('.')[0] : '';
  const browserFull = cleanBrowserName || 'Chrome';

  // 2. OS details
  let osName = result.os.name || '';
  let osVersion = result.os.version || '';

  // Special refinement for Windows 10 vs 11
  if (osName === 'Windows' && !osVersion && /Windows NT 10.0/i.test(ua)) {
    osVersion = '11/10';
  }
  const osFull = [osName, osVersion].filter(Boolean).join(' ') || 'Unknown OS';

  // 3. Device Brand & Model
  let vendor = result.device.vendor || '';
  let model = result.device.model || '';
  let rawType = (result.device.type || '').toLowerCase();

  // Additional regex heuristics for Android manufacturers if not categorized by parser
  if (!vendor || !model) {
    if (/Oppo/i.test(ua)) {
      vendor = vendor || 'Oppo';
      const m = ua.match(/Oppo\s+([^;)\/]+)/i);
      if (m && m[1]) model = model || m[1].trim();
    } else if (/Vivo/i.test(ua)) {
      vendor = vendor || 'Vivo';
      const m = ua.match(/Vivo\s+([^;)\/]+)/i);
      if (m && m[1]) model = model || m[1].trim();
    } else if (/Realme/i.test(ua)) {
      vendor = vendor || 'Realme';
      const m = ua.match(/Realme\s+([^;)\/]+)/i);
      if (m && m[1]) model = model || m[1].trim();
    } else if (/OnePlus/i.test(ua)) {
      vendor = vendor || 'OnePlus';
    } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
      vendor = vendor || 'Xiaomi';
    } else if (/Samsung|SM-[A-Z0-9]+/i.test(ua)) {
      vendor = vendor || 'Samsung';
    } else if (/Pixel\s+[0-9a-zA-Z]+/i.test(ua)) {
      vendor = vendor || 'Google';
      const m = ua.match(/Pixel\s+([0-9a-zA-Z\s]+)/i);
      if (m && m[1]) model = model || `Pixel ${m[1].trim()}`;
    } else if (/iPhone/i.test(ua)) {
      vendor = 'Apple';
      model = model || 'iPhone';
    } else if (/iPad/i.test(ua)) {
      vendor = 'Apple';
      model = model || 'iPad';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      vendor = 'Apple';
      model = model || 'MacBook';
    }
  }

  // Determine normalized device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (rawType === 'tablet' || /ipad|tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (rawType === 'mobile' || /mobile|android|iphone|ipod/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Construct dynamic name adhering strictly to requirement:
  // e.g. "Oppo F31 Pro / Android 15 / Chrome"
  let brandModelStr = '';
  if (vendor && model) {
    if (model.toLowerCase().startsWith(vendor.toLowerCase()) || model.toLowerCase().includes(vendor.toLowerCase())) {
      brandModelStr = model;
    } else {
      brandModelStr = `${vendor} ${model}`;
    }
  } else if (model) {
    brandModelStr = model;
  } else if (vendor) {
    brandModelStr = vendor;
  }

  let deviceName = '';
  if (brandModelStr) {
    deviceName = `${brandModelStr} / ${osFull} / ${browserFull}`;
  } else {
    deviceName = `${osFull} / ${browserFull}`;
  }

  return {
    deviceName: deviceName.trim(),
    deviceType,
    browser: browserFull,
    os: osFull,
    brand: vendor || undefined,
    model: model || undefined,
  };
}

/**
 * 2. REAL IP EXTRACTION
 * Extracts client IP from reverse proxies, Cloudflare, load balancers, or socket.
 */
export function extractClientIpAddress(req: any): string {
  if (!req) return '127.0.0.1';

  // 1. x-forwarded-for header
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const list = typeof xForwardedFor === 'string' ? xForwardedFor.split(',') : xForwardedFor;
    const first = (Array.isArray(list) ? list[0] : list).trim();
    if (first) {
      return first.replace(/^.*:/, '').trim();
    }
  }

  // 2. x-real-ip header
  const xRealIp = req.headers?.['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return xRealIp.trim().replace(/^.*:/, '').trim();
  }

  // 3. cf-connecting-ip (Cloudflare)
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  // 4. Socket remote address
  const socketAddr = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const cleaned = socketAddr.replace(/^.*:/, '').trim();
  return cleaned || '127.0.0.1';
}

/**
 * 2. REAL LOCATION DETECTION (IP Geolocation Lookup)
 * Fetches real location metadata (City, State/Region, Country) using free IP Geolocation APIs.
 */
export async function lookupIpLocation(rawIp?: string): Promise<GeoLocationInfo> {
  const ip = (rawIp || '').trim().replace(/^.*:/, '');

  const isLocalOrPrivate =
    !ip ||
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);

  // Return cached result if already resolved
  const cacheKey = isLocalOrPrivate ? '__SELF_PUBLIC_IP__' : ip;
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey)!;
  }

  // Primary: ip-api.com
  try {
    const targetUrl = isLocalOrPrivate
      ? 'http://ip-api.com/json/'
      : `http://ip-api.com/json/${encodeURIComponent(ip)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.status === 'success') {
        const city = data.city || '';
        const state = data.regionName || data.region || '';
        const country = data.country || '';
        const formatted = [city, state, country].filter(Boolean).join(', ') || 'Unknown Location';
        const resolvedIp = (isLocalOrPrivate && data.query ? data.query : ip) || data.query || '127.0.0.1';

        const info: GeoLocationInfo = {
          ip: resolvedIp,
          city,
          state,
          country,
          formattedLocation: formatted,
        };

        geoCache.set(cacheKey, info);
        return info;
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // Secondary fallback: ipapi.co
  try {
    const targetUrl = isLocalOrPrivate
      ? 'https://ipapi.co/json/'
      : `https://ipapi.co/${encodeURIComponent(ip)}/json/`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      if (data && !data.error) {
        const city = data.city || '';
        const state = data.region || '';
        const country = data.country_name || data.country || '';
        const formatted = [city, state, country].filter(Boolean).join(', ') || 'Unknown Location';
        const resolvedIp = (isLocalOrPrivate && data.ip ? data.ip : ip) || data.ip || '127.0.0.1';

        const info: GeoLocationInfo = {
          ip: resolvedIp,
          city,
          state,
          country,
          formattedLocation: formatted,
        };

        geoCache.set(cacheKey, info);
        return info;
      }
    }
  } catch (err) {
    // Both failed
  }

  // Fallback defaults if offline
  const fallbackInfo: GeoLocationInfo = {
    ip: isLocalOrPrivate ? '127.0.0.1' : ip,
    city: 'Local Area',
    state: '',
    country: '',
    formattedLocation: isLocalOrPrivate ? 'Local Verified Network' : 'Unknown Location',
  };

  return fallbackInfo;
}
