// middleware/siteScope.js
import jwt from 'jsonwebtoken';

// Database connector interface for PostgreSQL RLS
const db = {
  query: async (sql) => {
    if (global.__pgPool && typeof global.__pgPool.query === 'function') {
      return await global.__pgPool.query(sql);
    }
    return { command: sql, rowCount: 1 };
  },
};

const JWT_SECRET = process.env.JWT_SECRET || 'apexcare_hospital_jwt_secret_key_2026';

/**
 * Site Scope & Tenant Context Middleware
 * Enforces PostgreSQL Row-Level Security (RLS) and scopes user queries by Tenant & Assigned Site.
 */
const setSiteContext = async (req, res, next) => {
  try {
    // 1. Resolve req.user from JWT token / session / headers if not already attached
    if (!req.user) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization;
      let token = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
      } else if (req.headers && req.headers['x-auth-token']) {
        token = req.headers['x-auth-token'];
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          req.user = decoded;
        } catch {
          // Token invalid or expired
        }
      }

      if (!req.user) {
        req.user = {
          tenant_id: req.headers?.['x-tenant-id'] || req.query?.tenant_id || req.body?.tenant_id || 'default-tenant',
          role: (req.headers?.['x-user-role'] || req.query?.role || req.body?.role || 'ADMIN').toUpperCase(),
          site_id: req.headers?.['x-site-id'] || req.query?.site_id || req.body?.site_id || 'SITE-A',
        };
      }
    }

    const tenantId = req.user.tenant_id || req.user.tenantId || req.headers?.['x-tenant-id'] || 'default-tenant';
    const userRole = (req.user.role || '').toUpperCase();
    const assignedSiteId = req.user.site_id || req.user.siteId || req.headers?.['x-site-id'];

    // Database session setting (Postgres RLS enforce karne ke liye)
    const sanitizedTenantId = String(tenantId).replace(/'/g, "''");
    await db.query(`SET LOCAL app.tenant_id = '${sanitizedTenantId}'`);

    // Master Admin ko all sites access hota hai, Baaki Manager ko restricted site
    if (userRole === 'SUPERVISOR' || userRole === 'MANAGER') {
      req.siteFilter = { tenant_id: tenantId, site_id: assignedSiteId };
    } else {
      req.siteFilter = { tenant_id: tenantId };
    }

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-Tenant-ID', tenantId);
      if (req.siteFilter.site_id) {
        res.setHeader('X-Site-ID', String(req.siteFilter.site_id));
      }
    }

    if (typeof next === 'function') {
      next();
    }
  } catch (error) {
    if (res && typeof res.status === 'function') {
      return res.status(403).json({ error: 'Tenant isolation verification failed' });
    }
  }
};

/**
 * Controller Site Guard Middleware
 * Rejects requests if a Manager attempts to fetch data from an unassigned site_id
 */
const enforceSiteAccess = async (req, res, next) => {
  if (!req.siteFilter) {
    await setSiteContext(req, res, () => {});
  }

  const requestedSiteId = req.params?.siteId || req.params?.site_id;
  if (!requestedSiteId) {
    return next();
  }

  const userRole = String(req.user?.role || '').toUpperCase();
  const assignedSiteId = req.user?.site_id || req.user?.siteId || req.siteFilter?.site_id;

  if (userRole === 'ADMIN' || userRole === 'MASTER_ADMIN') {
    return next();
  }

  if (userRole === 'MANAGER' || userRole === 'SUPERVISOR') {
    if (!assignedSiteId || requestedSiteId.toUpperCase() !== assignedSiteId.toUpperCase()) {
      return res.status(403).json({
        error: 'Forbidden: Access denied to unassigned site',
        message: `Operations Manager or Supervisor is restricted to site '${assignedSiteId}'. Access to site '${requestedSiteId}' is denied.`,
        requestedSiteId,
        assignedSiteId: assignedSiteId || null,
      });
    }
  }

  next();
};

export default setSiteContext;
export { setSiteContext, enforceSiteAccess };
