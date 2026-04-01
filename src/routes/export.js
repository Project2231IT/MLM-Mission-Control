const express = require('express');
const { pool } = require('../utils/db');
const router = express.Router();

router.get('/csv', async (req, res) => {
  try {
    const { location, dateFrom, dateTo, guestType } = req.query;

    let conditions = [];
    let params = [];
    let paramIdx = 1;

    if (location && location !== 'all') {
      conditions.push(`v.location_code = $${paramIdx++}`);
      params.push(location);
    }
    if (dateFrom) {
      conditions.push(`v.start_time >= $${paramIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`v.start_time <= $${paramIdx++}`);
      params.push(dateTo);
    }
    if (guestType === 'new') {
      conditions.push('g.total_visits = 1');
    } else if (guestType === 'returning') {
      conditions.push('g.total_visits > 1');
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(`
      SELECT DISTINCT
        g.email,
        g.first_name,
        g.last_name,
        g.mobile_phone,
        g.age,
        g.total_visits,
        g.first_seen,
        g.last_seen,
        array_agg(DISTINCT v.location_code) as locations
      FROM guests g
      JOIN visits v ON g.id = v.guest_id
      ${where}
      GROUP BY g.id
      ORDER BY g.last_seen DESC
    `, params);

    // Build CSV
    const headers = ['Email', 'First Name', 'Last Name', 'Mobile Phone', 'Age', 'Total Visits', 'First Seen', 'Last Seen', 'Locations'];
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      csvRows.push([
        escCsv(row.email),
        escCsv(row.first_name),
        escCsv(row.last_name),
        escCsv(row.mobile_phone),
        escCsv(row.age),
        row.total_visits,
        escCsv(row.first_seen ? new Date(row.first_seen).toISOString().split('T')[0] : ''),
        escCsv(row.last_seen ? new Date(row.last_seen).toISOString().split('T')[0] : ''),
        escCsv((row.locations || []).filter(l => l !== 'UNK').join('; ')),
      ].join(','));
    }

    const csv = csvRows.join('\n');
    const filename = `guest-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

function escCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

module.exports = router;
