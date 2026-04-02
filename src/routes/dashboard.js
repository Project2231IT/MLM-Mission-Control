const express = require('express');
const { pool } = require('../utils/db');
const router = express.Router();

// Main dashboard stats
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
      // Total unique guests
      pool.query('SELECT COUNT(*) as count FROM guests'),

      // This week's unique guests
      pool.query(`
        SELECT COUNT(DISTINCT guest_id) as count FROM visits
        WHERE start_time >= NOW() - INTERVAL '7 days'
      `),

      // New vs returning (guests with 1 visit vs multiple)
      pool.query(`
        SELECT
          COUNT(CASE WHEN total_visits = 1 THEN 1 END) as new_guests,
          COUNT(CASE WHEN total_visits > 1 THEN 1 END) as returning_guests
        FROM guests
      `),

      // Per-location breakdown
      pool.query(`
        SELECT location_code,
          COUNT(DISTINCT guest_id) as unique_guests,
          COUNT(*) as total_visits
        FROM visits
        WHERE location_code != 'UNK'
        GROUP BY location_code
        ORDER BY unique_guests DESC
      `),

      // Top 10 returning visitors
      pool.query(`
        SELECT g.email, g.first_name, g.last_name, g.total_visits, g.last_seen,
          array_agg(DISTINCT v.location_code) as locations
        FROM guests g
        JOIN visits v ON g.id = v.guest_id
        WHERE g.total_visits > 1
        GROUP BY g.id
        ORDER BY g.total_visits DESC
        LIMIT 10
      `),

      // Age demographics
      pool.query(`
        SELECT
          CASE
            WHEN age IS NULL OR age = '' THEN 'Unknown'
            WHEN CAST(age AS INTEGER) < 18 THEN 'Under 18'
            WHEN CAST(age AS INTEGER) BETWEEN 18 AND 24 THEN '18-24'
            WHEN CAST(age AS INTEGER) BETWEEN 25 AND 34 THEN '25-34'
            WHEN CAST(age AS INTEGER) BETWEEN 35 AND 44 THEN '35-44'
            WHEN CAST(age AS INTEGER) BETWEEN 45 AND 54 THEN '45-54'
            WHEN CAST(age AS INTEGER) BETWEEN 55 AND 64 THEN '55-64'
            ELSE '65+'
          END as age_group,
          COUNT(*) as count
        FROM guests
        WHERE age ~ '^[0-9]+$' OR age IS NULL OR age = ''
        GROUP BY age_group
        ORDER BY age_group
      `),

      // Peak days of week
      pool.query(`
        SELECT EXTRACT(DOW FROM start_time) as day_of_week,
          COUNT(*) as visit_count
        FROM visits
        WHERE start_time IS NOT NULL
        GROUP BY day_of_week
        ORDER BY day_of_week
      `),

      // Peak hours
      pool.query(`
        SELECT EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as visit_count
        FROM visits
        WHERE start_time IS NOT NULL
        GROUP BY hour
        ORDER BY hour
      `),

      // Cross-location visitors
      pool.query(`
        SELECT g.email, g.first_name, g.last_name, g.total_visits,
          array_agg(DISTINCT v.location_code) as locations,
          COUNT(DISTINCT v.location_code) as location_count
        FROM guests g
        JOIN visits v ON g.id = v.guest_id
        WHERE v.location_code != 'UNK'
        GROUP BY g.id
        HAVING COUNT(DISTINCT v.location_code) > 1
        ORDER BY location_count DESC, g.total_visits DESC
        LIMIT 25
      `),

      // Recent uploads
      pool.query('SELECT * FROM uploads ORDER BY uploaded_at DESC LIMIT 5'),

      // Total visits
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

// Portal-specific stats
router.get('/portal-stats', async (req, res) => {
  try {
    const [recentLogins, returningGuests, portalStats] = await Promise.all([
      // Recent portal logins (last 50)
      pool.query(`
        SELECT g.email, g.first_name, g.last_name, g.total_visits,
               v.mac, v.ssid, v.start_time, v.ap_name
        FROM visits v
        JOIN guests g ON v.guest_id = g.id
        WHERE v.auth_method = 'portal'
        ORDER BY v.start_time DESC
        LIMIT 50
      `),
      
      // Returning guests (more than 1 visit via portal)
      pool.query(`
        SELECT g.email, g.first_name, g.last_name, g.total_visits,
               g.first_seen, g.last_seen,
               m.mac
        FROM guests g
        LEFT JOIN mac_addresses m ON m.guest_id = g.id
        WHERE g.total_visits > 1
        ORDER BY g.total_visits DESC, g.last_seen DESC
        LIMIT 50
      `),
      
      // Aggregate portal stats
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
