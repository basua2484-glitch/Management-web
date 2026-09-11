import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

function attendanceApiPlugin(): Plugin {
  // In-memory session store for dev server API
  const inMemorySessions: Record<string, Array<{ id: string; punch_in: string; punch_out: string | null }>> = {};

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
      server.middlewares.use((req, res, next) => {
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
          const urlObj = new URL(req.url, 'http://localhost:3000');
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
              res.end(
                JSON.stringify({
                  status: 'success',
                  message: `Punch ${parsed.action_type || 'action'} synchronized successfully`,
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
      rollupOptions: {
        output: {
          manualChunks: undefined,
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
