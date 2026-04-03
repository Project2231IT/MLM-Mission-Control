const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'guest_wifi',
  user: process.env.DB_USER || 'guestadmin',
  password: process.env.DB_PASSWORD || 'GuestWifi2024!Secure',
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS guests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        mobile_phone VARCHAR(50),
        age VARCHAR(10),
        first_seen TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        total_visits INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        guest_id INTEGER REFERENCES guests(id),
        mac VARCHAR(50),
        hostname VARCHAR(255),
        start_time TIMESTAMPTZ,
        expire_time TIMESTAMPTZ,
        visit_count INTEGER,
        device VARCHAR(255),
        ap_name VARCHAR(255),
        ssid VARCHAR(255),
        location_code VARCHAR(10),
        rssi INTEGER,
        auth_method VARCHAR(100),
        raw_custom_field TEXT,
        imported_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255),
        rows_imported INTEGER,
        new_guests INTEGER,
        returning_guests INTEGER,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_visits_guest_id ON visits(guest_id);
      CREATE INDEX IF NOT EXISTS idx_visits_location ON visits(location_code);
      CREATE INDEX IF NOT EXISTS idx_visits_start_time ON visits(start_time);
      CREATE INDEX IF NOT EXISTS idx_visits_ssid ON visits(ssid);
      CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

      CREATE TABLE IF NOT EXISTS mac_addresses (
        id SERIAL PRIMARY KEY,
        mac VARCHAR(50) UNIQUE NOT NULL,
        guest_id INTEGER REFERENCES guests(id),
        device_name VARCHAR(255),
        first_seen TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_mac_addresses_mac ON mac_addresses(mac);
      CREATE INDEX IF NOT EXISTS idx_mac_addresses_guest_id ON mac_addresses(guest_id);

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Auto-create default admin if no users exist
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      const adminPass = process.env.ADMIN_PASS || 'P2231GuestAdmin';
      const hash = await bcrypt.hash(adminPass, 10);
      await client.query(
        `INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        ['admin', 'admin@project2231.com', hash, 'admin']
      );
      console.log('Default admin user created');
    }

    // Seed default settings if not present
    await client.query(`
      INSERT INTO app_settings (key, value) VALUES
        ('webhook_url', ''),
        ('webhook_enabled', 'false'),
        ('app_name', 'Guest WiFi Analytics')
      ON CONFLICT (key) DO NOTHING
    `);

  } finally {
    client.release();
  }
}

async function logAudit(userId, action, details, ipAddress) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId || null, action, details || null, ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { pool, initDb, logAudit };
