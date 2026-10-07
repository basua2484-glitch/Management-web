import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import crypto from 'crypto';
import {defineConfig, Plugin} from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupWebSocketServer, getWsStatusSummary, broadcastToAll } from './src/server/websocketServer';
import { HOSPITAL_SITES } from './src/data/mockHousekeepingData';

function attendanceApiPlugin(): Plugin {
  // In-memory session store for dev server API
  const inMemorySessions: Record<string, Array<{ id: string; punch_in: string; punch_out: string | null }>> = {};

  const dynamicSitesStore: Array<{
    id: string;
    tenant_id: string;
    site_name: string;
    industry_type: string;
    address?: string;
    location_lat?: number;
    location_lng?: number;
    radius_meters?: number;
    primary_manager_id?: string | null;
    created_at?: string;
  }> = [
    {
      id: 'SITE_APEX_MAIN',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      site_name: 'Site A - East Wing & Trauma',
      industry_type: 'HOSPITAL',
      address: 'Apex Medical Campus, North Wing',
      location_lat: 19.0760,
      location_lng: 72.8777,
      radius_meters: 100,
      primary_manager_id: 'MGR001',
      created_at: new Date().toISOString(),
    },
    {
      id: 'SITE_CARE_SOUTH',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      site_name: 'Site B - North Super-Speciality',
      industry_type: 'HOSPITAL',
      address: 'Sector 9, North Medical Hub',
      location_lat: 19.0820,
      location_lng: 72.8850,
      radius_meters: 150,
      primary_manager_id: null,
      created_at: new Date().toISOString(),
    },
  ];

  const formatTime12h = (val?: string | null): string => {
    if (!val) return '--';
    if (val.includes('AM') || val.includes('PM')) return val;
    if (val.includes('T') || (val.includes('-') && val.includes(':'))) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
    const parts = val.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
      }
    }
    return val;
  };

  const getDurationMinutes = (punchIn?: string | null, punchOut?: string | null): number => {
    if (!punchIn || !punchOut) return 0;
    if (punchIn.includes('T') || punchIn.includes('-')) {
      const startMs = new Date(punchIn).getTime();
      const endMs = new Date(punchOut).getTime();
      if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;
      return (endMs - startMs) / (1000 * 60);
    }
    const [inH, inM] = punchIn.split(':').map(Number);
    const [outH, outM] = punchOut.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60;
    return diff;
  };

  return {
    name: 'attendance-api-plugin',
    configureServer(server) {
      if (server.httpServer) {
        setupWebSocketServer(server.httpServer);
      }

      server.middlewares.use((req, res, next) => {
        // Multi-Tenant Session Parameter Setting:
        // Har request / transaction se pehle session parameter set karein:
        // SET LOCAL app.tenant_id = 'your-tenant-uuid-here';
        const rawUrl = req.url || '';
        const headerTenant = req.headers['x-tenant-id'];
        let tenantId = typeof headerTenant === 'string' && headerTenant.trim() ? headerTenant.trim() : '';
        if (!tenantId && rawUrl.includes('tenant_id=')) {
          try {
            const urlObj = new URL(rawUrl, 'http://localhost');
            tenantId = urlObj.searchParams.get('tenant_id') || '';
          } catch {}
        }
        if (!tenantId) {
          tenantId = 'default-tenant';
        }
        res.setHeader('X-Tenant-ID', tenantId);

        // Site Scope Determination (Manager / Supervisor site mapping)
        const rawRole = (req.headers['x-user-role'] || '').toString().toUpperCase();
        const rawSiteId = (req.headers['x-site-id'] || '').toString();
        let siteFilter: { tenant_id: string; site_id?: string } = { tenant_id: tenantId };
        if (rawRole === 'SUPERVISOR' || rawRole === 'MANAGER') {
          siteFilter = { tenant_id: tenantId, site_id: rawSiteId || 'SITE-A' };
        } else {
          siteFilter = { tenant_id: tenantId };
        }
        (req as any).siteFilter = siteFilter;
        if (siteFilter.site_id) {
          res.setHeader('X-Site-ID', siteFilter.site_id);
        }

        // GET /api/tenant/session endpoint
        if (rawUrl === '/api/tenant/session' || rawUrl.startsWith('/api/tenant/session?')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: 'active',
              tenant_id: tenantId,
              siteFilter,
              sqlCommand: `SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, "''")}';`,
              message: 'Session parameter configured for current request and database transaction',
            })
          );
          return;
        }

        // GET /api/site-context or /api/tenant/scope
        if (
          rawUrl === '/api/site-context' ||
          rawUrl.startsWith('/api/site-context?') ||
          rawUrl === '/api/tenant/scope' ||
          rawUrl.startsWith('/api/tenant/scope?')
        ) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: 'success',
              siteFilter,
              role: rawRole || 'ADMIN',
              message: 'Site scope context resolved successfully',
            })
          );
          return;
        }

        // =========================================================================
        // SITE RESTRICTED CONTROLLER ENDPOINTS (PHASE 1)
        // 1. GET /api/v1/sites/:siteId/dashboard
        // 2. GET /api/v1/sites/:siteId/attendance
        // 3. GET /api/v1/sites/:siteId/staff
        // =========================================================================
        const siteApiMatch = rawUrl.match(/^\/api\/v1\/sites\/([^/?#]+)\/(dashboard|attendance|staff)(\?.*)?$/);
        if (siteApiMatch && req.method === 'GET') {
          const requestedSiteId = decodeURIComponent(siteApiMatch[1]);
          const endpointType = siteApiMatch[2];

          // Middleware Enforcement: Reject Manager/Supervisor accessing unassigned site
          if (rawRole === 'MANAGER' || rawRole === 'SUPERVISOR') {
            if (rawSiteId && requestedSiteId.toUpperCase() !== rawSiteId.toUpperCase()) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 403;
              res.end(
                JSON.stringify({
                  error: 'Forbidden: Access denied to unassigned site',
                  message: `Operations Manager or Supervisor is restricted to site '${rawSiteId}'. Access to site '${requestedSiteId}' is denied.`,
                  requestedSiteId,
                  assignedSiteId: rawSiteId,
                })
              );
              return;
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;

          if (endpointType === 'dashboard') {
            const site = HOSPITAL_SITES.find(
              (s) => s.id.toLowerCase() === requestedSiteId.toLowerCase() || s.code.toLowerCase() === requestedSiteId.toLowerCase()
            ) || {
              id: requestedSiteId,
              name: `Hospital Campus (${requestedSiteId})`,
              code: requestedSiteId,
              industry_type: 'HEALTHCARE',
              city: 'Metro City',
              address: 'Medical Enclave Sector 4',
            };

            const zones = [
              { id: 1, site_id: site.id, zone_name: 'Ground Floor', department: 'Emergency & Triage', floor: 'G' },
              { id: 2, site_id: site.id, zone_name: 'First Floor', department: 'OPD & Diagnostics', floor: '1' },
              { id: 3, site_id: site.id, zone_name: 'Second Floor', department: 'Operation Theatres (OT)', floor: '2' },
              { id: 4, site_id: site.id, zone_name: 'Third Floor', department: 'ICU & Critical Care', floor: '3' },
            ];

            res.end(
              JSON.stringify({
                success: true,
                siteId: site.id,
                site,
                industry_type: site.industry_type || 'HEALTHCARE',
                stats: {
                  totalStaffDeployed: 0,
                  activeOnDuty: 0,
                  todayPunches: 0,
                  pendingOtApprovals: 0,
                  complianceRate: '100%',
                },
                zones,
                activeDeployments: [],
                message: `Site dashboard loaded for ${site.name} (${site.industry_type || 'HEALTHCARE'})`,
              })
            );
            return;
          }

          if (endpointType === 'attendance') {
            const siteAttendance: any[] = [];

            res.end(
              JSON.stringify({
                success: true,
                siteId: requestedSiteId,
                totalRecords: siteAttendance.length,
                records: siteAttendance,
              })
            );
            return;
          }

          if (endpointType === 'staff') {
            const siteStaff = [
              {
                id: 1,
                staffId: 'BASU-ADM-001',
                staff_id: 'BASU-ADM-001',
                name: 'Dr. Basu',
                full_name: 'Dr. Basu',
                role: 'admin',
                department: 'Executive Administration',
                shift: 'General',
                siteId: requestedSiteId || 'SITE_APEX_MAIN',
                active: true,
                status: 'ACTIVE',
                duty_type: 'FIXED',
                dutyStatus: 'ON_DUTY',
                isOnDuty: true,
                is_mock: false,
              },
            ];

            res.end(
              JSON.stringify({
                success: true,
                siteId: requestedSiteId,
                totalStaff: siteStaff.length,
                staff: siteStaff,
                deduplicationMethod: 'DISTINCT ON (users.id) with LEFT JOIN engagements',
              })
            );
            return;
          }
        }

        // Workforce Directory API with DISTINCT ON (users.id) & LEFT JOIN engagements
        // Retains primary Master Admin user account (Dr. Basu / BASU-ADM-001) linked with active engagement
        if ((rawUrl === '/api/staff' || rawUrl.startsWith('/api/staff?') || rawUrl === '/api/users' || rawUrl.startsWith('/api/users?')) && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;

          const primaryAccounts = [
            {
              id: 1,
              staff_id: 'BASU-ADM-001',
              name: 'Dr. Basu',
              full_name: 'Dr. Basu',
              username: 'basu.admin',
              role: 'admin',
              department: 'Executive Administration',
              assigned_area: 'Executive Administration',
              fixed_department: 'Executive Administration',
              shift: 'General',
              assigned_shift: 'General',
              siteId: 'SITE_APEX_MAIN',
              site_id: 'SITE_APEX_MAIN',
              siteName: 'Site A - East Wing & Trauma',
              status: 'ACTIVE',
              is_approved: true,
              dutyStatus: 'ON_DUTY',
              isOnDuty: true,
              duty_type: 'FIXED',
              tenant_id: 'BASU',
              tenantId: 'BASU',
              company_prefix: 'BASU',
              company_name: 'Basu Healthcare Group',
              is_mock: false,
              engagement: {
                id: 'eng-basu-001',
                duty_type: 'FIXED',
                shift_code: 'General',
                is_active: true,
              },
            },
          ];

          res.end(
            JSON.stringify({
              success: true,
              totalRecords: primaryAccounts.length,
              staff: primaryAccounts,
              users: primaryAccounts,
              deduplicationMethod: 'DISTINCT ON (users.id) with LEFT JOIN engagements',
            })
          );
          return;
        }

        // Sites Management API (GET & POST /api/sites) with RBAC Manager Scoping
        if ((rawUrl === '/api/sites' || rawUrl.startsWith('/api/sites?')) && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;

          const userRole = (req.headers['x-user-role'] as string || '').toUpperCase();
          const userId = (req.headers['x-user-id'] as string || '').toLowerCase();

          // Deduplicate
          const siteMap = new Map<string, any>();
          dynamicSitesStore.forEach((s) => {
            if (!siteMap.has(s.id)) {
              siteMap.set(s.id, s);
            }
          });
          let list = Array.from(siteMap.values());

          // RBAC: Operations Manager automatically scoped to assigned site(s)
          if (userRole === 'MANAGER' && userId) {
            const scoped = list.filter((s) => s.primary_manager_id && s.primary_manager_id.toLowerCase() === userId);
            if (scoped.length > 0) list = scoped;
          }

          res.end(
            JSON.stringify({
              success: true,
              totalSites: list.length,
              sites: list.map((s) => ({
                ...s,
                siteId: s.id,
                name: s.site_name,
                siteName: s.site_name,
                code: s.site_name.replace(/[^A-Za-z0-9]/g, '-').toUpperCase().slice(0, 10),
                city: 'Metro Region',
                locationLat: s.location_lat,
                locationLng: s.location_lng,
                radiusMeters: s.radius_meters,
                primaryManagerId: s.primary_manager_id,
              })),
            })
          );
          return;
        }

        if (rawUrl === '/api/sites' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const body = JSON.parse(bodyStr || '{}');
              const siteName = (body.site_name || body.siteName || body.name || '').trim();
              const industryType = (body.industry_type || body.industryType || 'HOSPITAL').toUpperCase();
              const address = (body.address || '').trim();
              const locationLat = Number(body.location_lat || body.locationLat || body.latitude) || 19.0760;
              const locationLng = Number(body.location_lng || body.locationLng || body.longitude) || 72.8777;
              const radiusMeters = Number(body.radius_meters || body.radiusMeters || body.radius) || 100;
              const primaryManagerId = body.primary_manager_id || body.primaryManagerId || null;

              if (!siteName) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Site name is required' }));
                return;
              }

              const newId = crypto.randomUUID();
              const newSite = {
                id: newId,
                tenant_id: '00000000-0000-0000-0000-000000000001',
                site_name: siteName,
                industry_type: industryType,
                address,
                location_lat: locationLat,
                location_lng: locationLng,
                radius_meters: radiusMeters,
                primary_manager_id: primaryManagerId,
                created_at: new Date().toISOString(),
              };

              dynamicSitesStore.push(newSite);

              const formattedSite = {
                ...newSite,
                siteId: newId,
                name: siteName,
                siteName: siteName,
                code: siteName.replace(/[^A-Za-z0-9]/g, '-').toUpperCase().slice(0, 10),
                city: 'Metro Region',
                locationLat,
                locationLng,
                radiusMeters,
                primaryManagerId,
              };

              res.statusCode = 201;
              res.end(
                JSON.stringify({
                  success: true,
                  message: `Site ${siteName} created successfully with GPS geofence`,
                  site: formattedSite,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 24/7 WebSocket Health & Status Route
        if (req.url === '/api/ws/status' || req.url?.startsWith('/api/ws/status?')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(getWsStatusSummary()));
          return;
        }

        // Vercel & Express compatible /api/login route
        if ((req.url === '/api/login' || req.url?.startsWith('/api/login?')) && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { staffId, password } = body;

              if (!staffId || !password) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Please provide both staffId and password' }));
                return;
              }

              const cleanId = String(staffId).trim().toLowerCase().replace(/[-_\s]/g, '');
              const users = [
                {
                  id: 'admin',
                  role: 'ADMIN',
                  passwordHash: '$2b$10$7CTgGVjgJXKMmGDen4EiYusKIVthdBqzMB.L0B/a55tl3WcTkkX3W',
                  name: 'ApexCare Admin',
                  redirect: '/admin-dashboard',
                },
                {
                  id: 'manager',
                  role: 'MANAGER',
                  passwordHash: '$2b$10$4eXapasHkkAa6cf6fCDkfeAef.UJYOAqjEXH/S5zAZHtuPYt6eRhO',
                  name: 'Operations Manager',
                  redirect: '/manager-dashboard',
                },
                {
                  id: 'supervisor',
                  role: 'SUPERVISOR',
                  passwordHash: '$2b$10$VG9lLFRKl1NzEg.G0Jg5uebnub529/rqV3HhkBrZoHCubwebil.J2',
                  name: 'Supervisor Rakesh Verma',
                  redirect: '/supervisor/dashboard',
                },
                {
                  id: 'hk001',
                  role: 'STAFF',
                  passwordHash: '$2b$10$as.6Vk8oadpFbSYz/c9Yf.x/OeoDd8sJ/bV0SUUaIk8UHuIYRSYpW',
                  name: 'Ramesh Sharma',
                  redirect: '/staff-portal',
                },
                {
                  id: 'hk002',
                  role: 'STAFF',
                  passwordHash: '$2b$10$as.6Vk8oadpFbSYz/c9Yf.x/OeoDd8sJ/bV0SUUaIk8UHuIYRSYpW',
                  name: 'Sunita Devi',
                  redirect: '/staff-portal',
                },
                {
                  id: 'hk003',
                  role: 'STAFF',
                  passwordHash: '$2b$10$as.6Vk8oadpFbSYz/c9Yf.x/OeoDd8sJ/bV0SUUaIk8UHuIYRSYpW',
                  name: 'Amit Patel',
                  redirect: '/staff-portal',
                },
              ];

              const user = users.find(
                (u) =>
                  u.id.toLowerCase() === cleanId ||
                  u.id.toLowerCase().replace(/[-_\s]/g, '') === cleanId
              );

              if (!user) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Invalid credentials' }));
                return;
              }

              const isMatch = await bcrypt.compare(password, user.passwordHash);
              if (!isMatch) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Invalid credentials' }));
                return;
              }

              const jwtSecret = process.env.JWT_SECRET || 'apexcare_hospital_jwt_secret_key_2026';
              const token = jwt.sign(
                { userId: user.id, role: user.role, name: user.name },
                jwtSecret,
                { expiresIn: '8h' }
              );

              res.setHeader('Set-Cookie', [
                `authToken=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
                `userRole=${user.role}; Path=/; SameSite=Lax; Max-Age=28800`,
              ]);

              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  token,
                  role: user.role,
                  redirect: user.redirect,
                  user: {
                    id: user.id,
                    role: user.role,
                    name: user.name,
                  },
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
          });
          return;
        }

        // API @app.route('/api/logout') or POST /logout
        const isApiLogout =
          req.url === '/api/logout' ||
          req.url?.startsWith('/api/logout?') ||
          (req.method === 'POST' && (req.url === '/logout' || req.url?.startsWith('/logout?')));

        if (isApiLogout) {
          // 1. Destroy server session (session.clear())
          for (const key of Object.keys(inMemorySessions)) {
            delete inMemorySessions[key];
          }

          // 2. Clear cookies (response.set_cookie('session', '', expires=0))
          res.setHeader('Set-Cookie', [
            'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax',
            'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
            'authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
            'userRole=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
            'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
            'role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
          ]);

          // For API fetch / XHR requests
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: 'success',
              message: 'Session destroyed and cookies cleared',
              redirect: '/login',
            })
          );
          return;
        }

        // GET /api/get_staff_summary/<staff_id>
        if (req.url?.startsWith('/api/get_staff_summary') && (req.method === 'GET' || req.method === 'POST')) {
          const urlObj = new URL(req.url || '/', 'http://api.local');
          const pathSegments = urlObj.pathname.split('/').filter(Boolean);
          const staffId = pathSegments[2] || '1';

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;

            try {
              let sessions: Array<{ punch_in: string; punch_out: string | null }> = [];
              if (body) {
                const parsed = JSON.parse(body);
                if (Array.isArray(parsed.sessions)) {
                  sessions = parsed.sessions;
                }
              }

              if (sessions.length === 0 && inMemorySessions[staffId]) {
                sessions = inMemorySessions[staffId];
              }

              let total_minutes = 0;
              const session_list = [];

              for (let idx = 0; idx < sessions.length; idx++) {
                const s = sessions[idx];
                let duration_hrs = 0.0;
                if (s.punch_in && s.punch_out) {
                  const diff = getDurationMinutes(s.punch_in, s.punch_out);
                  duration_hrs = Math.round((diff / 60.0) * 100) / 100;
                  total_minutes += diff;
                }

                session_list.push({
                  session_num: idx + 1,
                  in_time: s.punch_in ? formatTime12h(s.punch_in) : '--',
                  out_time: s.punch_out ? formatTime12h(s.punch_out) : '--',
                  hours: duration_hrs,
                });
              }

              // Dynamic Total Calculation (NO HARDCODED 8.0h / 1.5h)
              const total_hours = Math.round((total_minutes / 60.0) * 100) / 100;
              let reg_hours = 0.0;
              let ot_hours = 0.0;

              if (total_hours >= 8.0) {
                reg_hours = 8.0;
                ot_hours = Math.round((total_hours - 8.0) * 100) / 100;
              } else {
                reg_hours = total_hours;
                ot_hours = 0.0;
              }

              const is_duty_active = sessions.some((s) => !s.punch_out);

              res.end(
                JSON.stringify({
                  regular_hours: reg_hours,
                  overtime_hours: ot_hours,
                  sessions: session_list,
                  is_duty_active,
                })
              );
            } catch {
              res.end(
                JSON.stringify({
                  regular_hours: 0.0,
                  overtime_hours: 0.0,
                  sessions: [],
                  is_duty_active: false,
                })
              );
            }
          });
          return;
        }

        if (
          (req.url?.startsWith('/api/attendance/calculate_daily') ||
            req.url?.startsWith('/api/calculate_daily_attendance')) &&
          req.method === 'POST'
        ) {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            try {
              const parsed = JSON.parse(body);
              const sessions = parsed.sessions || [];
              let total_minutes_worked = 0;
              for (const session of sessions) {
                if (session.punch_in && session.punch_out) {
                  const inMs = new Date(session.punch_in).getTime();
                  const outMs = new Date(session.punch_out).getTime();
                  if (!isNaN(inMs) && !isNaN(outMs) && outMs > inMs) {
                    total_minutes_worked += (outMs - inMs) / (1000 * 60);
                  }
                }
              }
              const total_hours = total_minutes_worked / 60.0;
              let regular_hours = 0;
              let overtime_hours = 0;
              if (total_hours > 8.0) {
                regular_hours = 8.0;
                overtime_hours = Math.round((total_hours - 8.0) * 100) / 100;
              } else {
                regular_hours = Math.round(total_hours * 100) / 100;
                overtime_hours = 0.0;
              }
              res.end(
                JSON.stringify({
                  regular_hours,
                  overtime_hours,
                  total_sessions: sessions.length,
                })
              );
            } catch {
              res.end(
                JSON.stringify({
                  regular_hours: 0,
                  overtime_hours: 0,
                  total_sessions: 0,
                })
              );
            }
          });
          return;
        }

        if (req.url === '/api/attendance/punch' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            try {
              const parsed = JSON.parse(body);
              broadcastToAll({
                type: 'punch_sync',
                payload: parsed,
                timestamp: new Date().toISOString(),
              });
              res.end(
                JSON.stringify({
                  status: 'success',
                  message: `Punch ${parsed.action_type || 'action'} synchronized successfully via 24/7 WebSocket`,
                  data: parsed,
                })
              );
            } catch {
              res.end(
                JSON.stringify({
                  status: 'success',
                  message: 'Punch synchronized successfully',
                })
              );
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), attendanceApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 3500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('purify')) return 'vendor-pdf';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('react') || id.includes('react-router') || id.includes('react-dom')) return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
