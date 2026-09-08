import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function attendanceApiPlugin(): Plugin {
  return {
    name: 'attendance-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
