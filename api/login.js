// Example Vercel API Route: /api/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Database adapter (Server-side Only)
const DB = {
  async getUserById(staffId) {
    const cleanId = String(staffId || '').trim().toLowerCase().replace(/[-_\s]/g, '');

    const users = [
      {
        id: 'admin',
        role: 'ADMIN',
        passwordHash: '$2b$10$7CTgGVjgJXKMmGDen4EiYusKIVthdBqzMB.L0B/a55tl3WcTkkX3W', // admin123
        name: 'ApexCare Admin',
        redirect: '/admin-dashboard',
      },
      {
        id: 'manager',
        role: 'MANAGER',
        passwordHash: '$2b$10$4eXapasHkkAa6cf6fCDkfeAef.UJYOAqjEXH/S5zAZHtuPYt6eRhO', // manager123
        name: 'Operations Manager',
        redirect: '/manager-dashboard',
      },
      {
        id: 'hk001',
        role: 'STAFF',
        passwordHash: '$2b$10$as.6Vk8oadpFbSYz/c9Yf.x/OeoDd8sJ/bV0SUUaIk8UHuIYRSYpW', // staff123
        name: 'Ramesh Sharma',
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { staffId, password } = req.body || {};

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

  return res.status(200).json({
    success: true,
    token,
    role: user.role,
    redirect: user.redirect,
  });
}
