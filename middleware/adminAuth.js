const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-token';

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
