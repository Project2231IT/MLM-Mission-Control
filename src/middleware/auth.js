function authMiddleware(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // Legacy compatibility: check old 'authenticated' flag
  if (req.session && req.session.authenticated) {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const isAdmin = req.session.role === 'admin';
  // Legacy: if using old env-var auth but no role set, check env
  const legacyAdmin = req.session.authenticated && !req.session.userId;
  if (isAdmin || legacyAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
