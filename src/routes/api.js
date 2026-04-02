const express = require('express');
const { pool } = require('../utils/db');
const router = express.Router();

// Search guests
router.get('/guests', async (req, res) => {
  try {
    const { search, location, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = [];
    let params = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(g.email ILIKE $${paramIdx} OR g.first_name ILIKE $${paramIdx} OR g.last_name ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (location && location !== 'all') {
      conditions.push(`EXISTS (SELECT 1 FROM visits v2 WHERE v2.guest_id = g.id AND v2.location_code = $${paramIdx})`);
      params.push(location);
      paramIdx++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM guests g ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await pool.query(`
      SELECT g.*,
        array_agg(DISTINCT v.location_code) FILTER (WHERE v.location_code != 'UNK') as locations
      FROM guests g
      LEFT JOIN visits v ON g.id = v.guest_id
      ${where}
      GROUP BY g.id
      ORDER BY g.last_seen DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, params);

    res.json({
      guests: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guest detail
router.get('/guests/:id', async (req, res) => {
  try {
    const guest = await pool.query('SELECT * FROM guests WHERE id = $1', [req.params.id]);
    if (guest.rows.length === 0) return res.status(404).json({ error: 'Guest not found' });

    const visits = await pool.query(`
      SELECT * FROM visits WHERE guest_id = $1 ORDER BY start_time DESC
    `, [req.params.id]);

    res.json({ guest: guest.rows[0], visits: visits.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MAC address lookup
router.get('/check-mac/:mac', async (req, res) => {
  try {
    const mac = req.params.mac.trim().toUpperCase();
    const result = await pool.query(`
      SELECT m.mac, m.first_seen as mac_first_seen, m.last_seen as mac_last_seen,
             g.id, g.email, g.first_name, g.last_name, g.total_visits, g.last_seen, g.first_seen
      FROM mac_addresses m
      JOIN guests g ON m.guest_id = g.id
      WHERE m.mac = $1
    `, [mac]);
    
    if (result.rows.length === 0) {
      return res.json({ found: false, mac });
    }
    
    const row = result.rows[0];
    res.json({
      found: true,
      mac,
      guest: {
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        total_visits: row.total_visits,
        first_seen: row.first_seen,
        last_seen: row.last_seen
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
