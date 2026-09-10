import type { IncomingMessage, ServerResponse } from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface VercelRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  method?: string;
}

interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (data: any) => void;
  send: (data: any) => void;
}

// Secure Hospital Database Layer (Server-side Only)
const DB = {
  async getUserById(staffId: string) {
    const cleanId = String(staffId || '').trim().toLowerCase().replace(/[-_\s]/g, '');

    // Hospital staff records with bcrypt password hashes
    // admin123 -> $2b$10$7CTgGVjgJXKMmGDen4EiYusKIVthdBqzMB.L0B/a55tl3WcTkkX3W
    // manager123 -> $2b$10$4eXapasHkkAa6cf6fCDkfeAef.UJYOAqjEXH/S5zAZHtuPYt6eRhO
    // staff123 -> $2b$10$as.6Vk8oadpFbSYz/c9Yf.x/OeoDd8sJ/bV0SUUaIk8UHuIYRSYpW
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

    return (
      users.find(
        (u) =>
          u.id.toLowerCase() === cleanId ||
          u.id.toLowerCase().replace(/[-_\s]/g, '') === cleanId
      ) || null
    );
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const { staffId, password } = body;

  if (!staffId || !password) {
    return res.status(400).json({ error: 'Please provide both staffId and password' });
  }

  // Fetch user securely from Database (Not Frontend)
  const user = await DB.getUserById(staffId);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Compare hashed password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate Secure HttpOnly Cookie / Signed JWT Token
  const jwtSecret = process.env.JWT_SECRET || 'apexcare_hospital_jwt_secret_key_2026';
  const token = jwt.sign(
    { userId: user.id, role: user.role, name: user.name },
    jwtSecret,
    { expiresIn: '8h' }
  );

  // Set secure HTTP-only cookie if supported
  res.setHeader('Set-Cookie', [
    `authToken=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
    `userRole=${user.role}; Path=/; SameSite=Lax; Max-Age=28800`,
  ]);

  return res.status(200).json({
    success: true,
    token,
    role: user.role,
    redirect: user.redirect,
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
    },
  });
}
