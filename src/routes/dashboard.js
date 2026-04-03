const express = require('express');
const { pool } = require('../utils/db');
const router = express.Router();

// Main dashboard stats (legacy)
router.get('/stats', async (req, res) => {
  try {
    const [
      totalGuests,
      thisWeekGuests,
      newVsReturning,
      locationBreakdown,
      topReturning,
      ageDemographics,
      peakDays,
      peakHours,
      crossLocation,
      recentUploads,
      totalVisits
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM guests'),
      pool.query(`SELECT COUNT(DISTINCT guest_id) as count FROM visits WHERE start_time >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(CASE WHEN total_visits = 1 THEN 1 END) as new_guests, COUNT(CASE WHEN total_visits > 1 THEN 1 END) as returning_guests FROM guests`),
      pool.query(`SELECT location_code, COUNT(DISTINCT guest_id) as unique_guests, COUNT(*) as total_visits FROM visits WHERE location_code != 'UNK' GROUP BY location_code ORDER BY unique_guests DESC`),
      pool.query(`SELECT g.email, g.first_name, g.last_name, g.total_visits, g.last_seen, array_agg(DISTINCT v.location_code) as locations FROM guests g JOIN visits v ON g.id = v.guest_id WHERE g.total_visits > 1 GROUP BY g.id ORDER BY g.total_visits DESC LIMIT 10`),
      pool.query(`SELECT CASE WHEN age IS NULL OR age = '' THEN 'Unknown' WHEN CAST(age AS INTEGER) < 18 THEN 'Under 18' WHEN CAST(age AS INTEGER) BETWEEN 18 AND 24 THEN '18-24' WHEN CAST(age AS INTEGER) BETWEEN 25 AND 34 THEN '25-34' WHEN CAST(age AS INTEGER) BETWEEN 35 AND 44 THEN '35-44' WHEN CAST(age AS INTEGER) BETWEEN 45 AND 54 THEN '45-54' WHEN CAST(age AS INTEGER) BETWEEN 55 AND 64 THEN '55-64' ELSE '65+' END as age_group, COUNT(*) as count FROM guests WHERE age ~ '^[0-9]+$' OR age IS NULL OR age = '' GROUP BY age_group ORDER BY age_group`),
      pool.query(`SELECT EXTRACT(DOW FROM start_time) as day_of_week, COUNT(*) as visit_count FROM visits WHERE start_time IS NOT NULL GROUP BY day_of_week ORDER BY day_of_week`),
      pool.query(`SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as visit_count FROM visits WHERE start_time IS NOT NULL GROUP BY hour ORDER BY hour`),
      pool.query(`SELECT g.email, g.first_name, g.last_name, g.total_visits, array_agg(DISTINCT v.location_code) as locations, COUNT(DISTINCT v.location_code) as location_count FROM guests g JOIN visits v ON g.id = v.guest_id WHERE v.location_code != 'UNK' GROUP BY g.id HAVING COUNT(DISTINCT v.location_code) > 1 ORDER BY location_count DESC, g.total_visits DESC LIMIT 25`),
      pool.query('SELECT * FROM uploads ORDER BY uploaded_at DESC LIMIT 5'),
      pool.query('SELECT COUNT(*) as count FROM visits'),
    ]);

    res.json({
      totalGuests: parseInt(totalGuests.rows[0].count),
      thisWeekGuests: parseInt(thisWeekGuests.rows[0].count),
      totalVisits: parseInt(totalVisits.rows[0].count),
      newGuests: parseInt(newVsReturning.rows[0].new_guests),
      returningGuests: parseInt(newVsReturning.rows[0].returning_guests),
      locationBreakdown: locationBreakdown.rows,
      topReturning: topReturning.rows,
      ageDemographics: ageDemographics.rows,
      peakDays: peakDays.rows,
      peakHours: peakHours.rows,
      crossLocationVisitors: crossLocation.rows,
      recentUploads: recentUploads.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/overview — main KPIs
router.get('/overview', async (req, res) => {
  try {
    const [total, today, week, month, newVsRet, locations, recent] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM guests'),
      pool.query(`SELECT COUNT(DISTINCT guest_id) as count FROM visits WHERE start_time >= CURRENT_DATE`),
      pool.query(`SELECT COUNT(DISTINCT guest_id) as count FROM visits WHERE start_time >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(DISTINCT guest_id) as count FROM visits WHERE start_time >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(CASE WHEN total_visits = 1 THEN 1 END) as new_guests, COUNT(CASE WHEN total_visits > 1 THEN 1 END) as returning_guests FROM guests`),
      pool.query(`SELECT COUNT(DISTINCT location_code) as count FROM visits WHERE location_code != 'UNK'`),
      pool.query(`
        SELECT g.id, g.email, g.first_name, g.last_name, g.total_visits, v.start_time, v.location_code, v.ssid
        FROM visits v JOIN guests g ON v.guest_id = g.id
        WHERE v.auth_method = 'portal'
        ORDER BY v.start_time DESC LIMIT 10
      `),
    ]);

    const totalG = parseInt(total.rows[0].count);
    const newG = parseInt(newVsRet.rows[0].new_guests);
    const retG = parseInt(newVsRet.rows[0].returning_guests);

    res.json({
      totalGuests: totalG,
      todayGuests: parseInt(today.rows[0].count),
      weekGuests: parseInt(week.rows[0].count),
      monthGuests: parseInt(month.rows[0].count),
      newGuests: newG,
      returningGuests: retG,
      returningPercent: totalG > 0 ? Math.round((retG / totalG) * 100) : 0,
      activeLocations: parseInt(locations.rows[0].count),
      recentSignups: recent.rows,
    });
  } catch (err) {
    console.error('Overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/trends — time series data
router.get('/trends', async (req, res) => {
  try {
    const [daily, weekly, monthly, returningTrend] = await Promise.all([
      // Daily for last 30 days
      pool.query(`
        SELECT DATE(start_time) as date, COUNT(DISTINCT guest_id) as count
        FROM visits
        WHERE start_time >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(start_time)
        ORDER BY date ASC
      `),
      // Weekly for last 12 weeks
      pool.query(`
        SELECT DATE_TRUNC('week', start_time) as week, COUNT(DISTINCT guest_id) as count
        FROM visits
        WHERE start_time >= NOW() - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', start_time)
        ORDER BY week ASC
      `),
      // Monthly for last 12 months
      pool.query(`
        SELECT DATE_TRUNC('month', start_time) as month, COUNT(DISTINCT guest_id) as count
        FROM visits
        WHERE start_time >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', start_time)
        ORDER BY month ASC
      `),
      // Returning % over last 30 days
      pool.query(`
        SELECT DATE(v.start_time) as date,
          COUNT(DISTINCT v.guest_id) as total,
          COUNT(DISTINCT CASE WHEN g.total_visits > 1 THEN v.guest_id END) as returning
        FROM visits v
        JOIN guests g ON v.guest_id = g.id
        WHERE v.start_time >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(v.start_time)
        ORDER BY date ASC
      `),
    ]);

    res.json({
      daily: daily.rows,
      weekly: weekly.rows,
      monthly: monthly.rows,
      returningTrend: returningTrend.rows.map(r => ({
        date: r.date,
        total: parseInt(r.total),
        returning: parseInt(r.returning),
        percent: r.total > 0 ? Math.round((r.returning / r.total) * 100) : 0,
      })),
    });
  } catch (err) {
    console.error('Trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/locations — per-business breakdown
router.get('/locations', async (req, res) => {
  try {
    const [locations, crossLoc] = await Promise.all([
      pool.query(`
        SELECT
          v.location_code,
          COUNT(DISTINCT v.guest_id) as unique_guests,
          COUNT(*) as total_visits,
          COUNT(DISTINCT CASE WHEN g.total_visits = 1 THEN v.guest_id END) as new_guests,
          COUNT(DISTINCT CASE WHEN g.total_visits > 1 THEN v.guest_id END) as returning_guests
        FROM visits v
        JOIN guests g ON v.guest_id = g.id
        WHERE v.location_code != 'UNK'
        GROUP BY v.location_code
        ORDER BY unique_guests DESC
      `),
      pool.query(`
        SELECT COUNT(DISTINCT guest_id) as count
        FROM (
          SELECT guest_id FROM visits WHERE location_code != 'UNK'
          GROUP BY guest_id HAVING COUNT(DISTINCT location_code) > 1
        ) sub
      `),
    ]);

    res.json({
      locations: locations.rows,
      crossLocationCount: parseInt(crossLoc.rows[0].count),
    });
  } catch (err) {
    console.error('Locations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/peak-times — traffic patterns
router.get('/peak-times', async (req, res) => {
  try {
    const [hourly, daily, heatmap] = await Promise.all([
      pool.query(`
        SELECT EXTRACT(HOUR FROM start_time)::int as hour, COUNT(*) as count
        FROM visits WHERE start_time IS NOT NULL
        GROUP BY hour ORDER BY hour
      `),
      pool.query(`
        SELECT EXTRACT(DOW FROM start_time)::int as day, COUNT(*) as count
        FROM visits WHERE start_time IS NOT NULL
        GROUP BY day ORDER BY day
      `),
      pool.query(`
        SELECT
          EXTRACT(HOUR FROM start_time)::int as hour,
          EXTRACT(DOW FROM start_time)::int as day,
          COUNT(*) as count
        FROM visits WHERE start_time IS NOT NULL
        GROUP BY hour, day
        ORDER BY day, hour
      `),
    ]);

    res.json({
      hourly: hourly.rows,
      daily: daily.rows,
      heatmap: heatmap.rows,
    });
  } catch (err) {
    console.error('Peak times error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/guests — enhanced guest list
router.get('/guests', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const location = req.query.location || 'all';
  const guestType = req.query.guestType || 'all'; // new, returning
  const sortBy = req.query.sortBy || 'last_seen';
  const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;

  const validSorts = { visits: 'g.total_visits', last_seen: 'g.last_seen', first_seen: 'g.first_seen', name: 'g.last_name' };
  const orderBy = validSorts[sortBy] || 'g.last_seen';

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let pidx = 1;

    if (search) {
      whereClause += ` AND (g.email ILIKE $${pidx} OR g.first_name ILIKE $${pidx} OR g.last_name ILIKE $${pidx})`;
      params.push(`%${search}%`);
      pidx++;
    }
    if (guestType === 'new') { whereClause += ' AND g.total_visits = 1'; }
    if (guestType === 'returning') { whereClause += ' AND g.total_visits > 1'; }

    let locationJoin = '';
    if (location !== 'all') {
      locationJoin = `JOIN visits vloc ON g.id = vloc.guest_id AND vloc.location_code = $${pidx}`;
      params.push(location);
      pidx++;
    }

    if (dateFrom) {
      whereClause += ` AND g.last_seen >= $${pidx}`;
      params.push(dateFrom);
      pidx++;
    }
    if (dateTo) {
      whereClause += ` AND g.last_seen <= $${pidx}`;
      params.push(dateTo);
      pidx++;
    }

    const countParams = [...params];
    const dataParams = [...params, limit, offset];

    const [guestsRes, countRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT g.id, g.email, g.first_name, g.last_name, g.mobile_phone,
          g.total_visits, g.first_seen, g.last_seen,
          ARRAY(SELECT DISTINCT v2.location_code FROM visits v2 WHERE v2.guest_id = g.id AND v2.location_code != 'UNK') as locations
        FROM guests g ${locationJoin}
        ${whereClause}
        ORDER BY ${orderBy} ${sortDir}
        LIMIT $${pidx} OFFSET $${pidx + 1}
      `, dataParams),
      pool.query(`
        SELECT COUNT(DISTINCT g.id) as count FROM guests g ${locationJoin} ${whereClause}
      `, countParams),
    ]);

    const total = parseInt(countRes.rows[0].count);
    res.json({
      guests: guestsRes.rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error('Guests list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/guest/:id — individual guest detail
router.get('/guest/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [guest, visits, macs] = await Promise.all([
      pool.query('SELECT * FROM guests WHERE id = $1', [id]),
      pool.query(`
        SELECT * FROM visits WHERE guest_id = $1 ORDER BY start_time DESC
      `, [id]),
      pool.query('SELECT * FROM mac_addresses WHERE guest_id = $1', [id]),
    ]);

    if (guest.rows.length === 0) return res.status(404).json({ error: 'Guest not found' });

    const guestData = guest.rows[0];
    const locations = [...new Set(visits.rows.map(v => v.location_code).filter(l => l && l !== 'UNK'))];

    res.json({
      ...guestData,
      visits: visits.rows,
      macAddresses: macs.rows,
      locations,
    });
  } catch (err) {
    console.error('Guest detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/marketing — marketing-focused data
router.get('/marketing', async (req, res) => {
  try {
    const [lapsed30, lapsed60, lapsed90, topReturning, acquisitionRate, crossLoc] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as count FROM guests
        WHERE last_seen < NOW() - INTERVAL '30 days' AND last_seen >= NOW() - INTERVAL '60 days'
      `),
      pool.query(`
        SELECT COUNT(*) as count FROM guests
        WHERE last_seen < NOW() - INTERVAL '60 days' AND last_seen >= NOW() - INTERVAL '90 days'
      `),
      pool.query(`
        SELECT COUNT(*) as count FROM guests
        WHERE last_seen < NOW() - INTERVAL '90 days'
      `),
      pool.query(`
        SELECT g.id, g.email, g.first_name, g.last_name, g.total_visits, g.last_seen,
          ARRAY(SELECT DISTINCT v2.location_code FROM visits v2 WHERE v2.guest_id = g.id AND v2.location_code != 'UNK') as locations
        FROM guests g
        WHERE g.total_visits > 1
        ORDER BY g.total_visits DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT
          DATE_TRUNC('day', first_seen) as day,
          COUNT(*) as new_guests
        FROM guests
        WHERE first_seen >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
      `),
      pool.query(`
        SELECT g.id, g.email, g.first_name, g.last_name, g.total_visits,
          ARRAY(SELECT DISTINCT v2.location_code FROM visits v2 WHERE v2.guest_id = g.id AND v2.location_code != 'UNK') as locations
        FROM guests g
        WHERE (SELECT COUNT(DISTINCT v.location_code) FROM visits v WHERE v.guest_id = g.id AND v.location_code != 'UNK') > 1
        ORDER BY g.total_visits DESC
        LIMIT 20
      `),
    ]);

    res.json({
      lapsed: {
        days30: parseInt(lapsed30.rows[0].count),
        days60: parseInt(lapsed60.rows[0].count),
        days90: parseInt(lapsed90.rows[0].count),
      },
      topReturning: topReturning.rows,
      acquisitionRate: acquisitionRate.rows,
      crossLocationGuests: crossLoc.rows,
    });
  } catch (err) {
    console.error('Marketing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Portal-specific stats (legacy)
router.get('/portal-stats', async (req, res) => {
  try {
    const [recentLogins, returningGuests, portalStats] = await Promise.all([
      pool.query(`
        SELECT g.email, g.first_name, g.last_name, g.total_visits,
               v.mac, v.ssid, v.start_time, v.ap_name
        FROM visits v
        JOIN guests g ON v.guest_id = g.id
        WHERE v.auth_method = 'portal'
        ORDER BY v.start_time DESC
        LIMIT 50
      `),
      pool.query(`
        SELECT g.email, g.first_name, g.last_name, g.total_visits,
               g.first_seen, g.last_seen, m.mac
        FROM guests g
        LEFT JOIN mac_addresses m ON m.guest_id = g.id
        WHERE g.total_visits > 1
        ORDER BY g.total_visits DESC, g.last_seen DESC
        LIMIT 50
      `),
      pool.query(`
        SELECT
          COUNT(DISTINCT g.id) as total_portal_guests,
          COUNT(DISTINCT CASE WHEN g.total_visits > 1 THEN g.id END) as returning_count,
          ROUND(AVG(g.total_visits)::numeric, 1) as avg_visits,
          COUNT(DISTINCT m.mac) as unique_devices
        FROM guests g
        LEFT JOIN mac_addresses m ON m.guest_id = g.id
        WHERE EXISTS (SELECT 1 FROM visits v WHERE v.guest_id = g.id AND v.auth_method = 'portal')
      `)
    ]);

    const stats = portalStats.rows[0];
    res.json({
      recentLogins: recentLogins.rows,
      returningGuests: returningGuests.rows,
      totalPortalGuests: parseInt(stats.total_portal_guests) || 0,
      returningCount: parseInt(stats.returning_count) || 0,
      returningPercent: stats.total_portal_guests > 0
        ? Math.round((stats.returning_count / stats.total_portal_guests) * 100)
        : 0,
      avgVisits: parseFloat(stats.avg_visits) || 0,
      uniqueDevices: parseInt(stats.unique_devices) || 0
    });
  } catch (err) {
    console.error('Portal stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
