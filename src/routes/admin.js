const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, logAudit } = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const validRoles = ['admin', 'viewer'];
  const userRole = validRoles.includes(role) ? role : 'viewer';

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, is_active, created_at',
      [username, email || null, hash, userRole]
    );
    await logAudit(req.session.userId, 'user_created', `Created user: ${username} (${userRole})`, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { email, role, is_active } = req.body;
  const validRoles = ['admin', 'viewer'];

  try {
    const fields = [];
    const vals = [];
    let idx = 1;

    if (email !== undefined) { fields.push(`email = $${idx++}`); vals.push(email); }
    if (role !== undefined && validRoles.includes(role)) { fields.push(`role = $${idx++}`); vals.push(role); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); vals.push(is_active); }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    vals.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, email, role, is_active`,
      vals
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await logAudit(req.session.userId, 'user_updated', `Updated user ID: ${id}`, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
      [hash, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await logAudit(req.session.userId, 'password_reset', `Reset password for user ID: ${id}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id (soft delete)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  // Prevent deleting your own account
  if (parseInt(id) === req.session.userId) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, username',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await logAudit(req.session.userId, 'user_deactivated', `Deactivated user ID: ${id}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-log
router.get('/audit-log', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  try {
    const [logs, total] = await Promise.all([
      pool.query(`
        SELECT al.*, u.username
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query('SELECT COUNT(*) as count FROM audit_log'),
    ]);

    res.json({
      logs: logs.rows,
      total: parseInt(total.rows[0].count),
      page,
      pages: Math.ceil(parseInt(total.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings
router.post('/settings', async (req, res) => {
  const { webhook_url, webhook_enabled, app_name } = req.body;
  try {
    const updates = [];
    if (webhook_url !== undefined) updates.push(['webhook_url', webhook_url]);
    if (webhook_enabled !== undefined) updates.push(['webhook_enabled', String(webhook_enabled)]);
    if (app_name !== undefined) updates.push(['app_name', app_name]);

    for (const [key, value] of updates) {
      await pool.query(
        'INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, value]
      );
    }

    await logAudit(req.session.userId, 'settings_updated', 'Updated app settings', req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings/test-webhook
router.post('/settings/test-webhook', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM app_settings WHERE key = 'webhook_url'");
    const webhookUrl = result.rows[0]?.value;
    if (!webhookUrl) return res.status(400).json({ error: 'No webhook URL configured' });

    const payload = {
      event: 'test',
      message: 'Webhook test from Guest WiFi Analytics',
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await logAudit(req.session.userId, 'webhook_test', `Webhook test: ${response.status}`, req.ip);
    res.json({ success: response.ok, status: response.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test GoHighLevel connection
router.post('/test-ghl', requireAdmin, async (req, res) => {
  try {
    const { testGHLConnection } = require('../utils/gohighlevel');
    const result = await testGHLConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
