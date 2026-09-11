import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse extends ServerResponse {
  status?: (statusCode: number) => VercelResponse;
  json?: (data: any) => void;
  send?: (data: any) => void;
  redirect?: (url: string) => void;
}

function sendJson(res: VercelResponse, statusCode: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 204;
    res.end();
    return;
  }

  // Clear all session cookies (expires=0 / Max-Age=0)
  const expiredCookies = [
    'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
    'authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
    'userRole=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
    'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
    'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
    'role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
  ];

  try {
    res.setHeader('Set-Cookie', expiredCookies);
  } catch (err) {
    console.warn('Could not set Set-Cookie headers in logout:', err);
  }

  // Check if browser navigation request (Accept: text/html) or GET with redirect requested
  const accept = req.headers['accept'] || '';
  const isHtmlRequest = typeof accept === 'string' && accept.includes('text/html');

  if (isHtmlRequest && req.method === 'GET') {
    res.setHeader('Location', '/login');
    res.statusCode = 302;
    res.end();
    return;
  }

  return sendJson(res, 200, {
    success: true,
    message: 'Logged out successfully, session cleared and cookies removed.',
    redirect: '/login',
  });
}
