const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, logAudit } = require('../utils/db');
const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'P2231Guest@Admin';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Try DB-based auth first
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (valid) {
        req.session.authenticated = true;
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        // Update last_login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        await logAudit(user.id, 'login', `User ${user.username} logged in`, req.ip);

        return res.json({ success: true, role: user.role, username: user.username });
      }
    } else {
      // Fallback: env-var auth if no users in DB
      const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
      if (parseInt(userCount.rows[0].count) === 0) {
        if (username === ADMIN_USER && password === ADMIN_PASS) {
          req.session.authenticated = true;
          req.session.role = 'admin';
          req.session.username = username;
          return res.json({ success: true, role: 'admin', username });
        }
      }
    }

    await logAudit(null, 'login_failed', `Failed login attempt for: ${username}`, req.ip);
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err);
    // Emergency fallback to env-var auth
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      req.session.authenticated = true;
      req.session.role = 'admin';
      req.session.username = username;
      return res.json({ success: true, role: 'admin', username });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/logout', (req, res) => {
  if (req.session.userId) {
    logAudit(req.session.userId, 'logout', `User ${req.session.username} logged out`, req.ip);
  }
  req.session.destroy();
  res.json({ success: true });
});

// Get current session info
router.get('/me', (req, res) => {
  if (!req.session || (!req.session.userId && !req.session.authenticated)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    username: req.session.username || 'admin',
    role: req.session.role || 'admin',
    userId: req.session.userId || null,
  });
});

module.exports = router;
