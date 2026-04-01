const { Pool } = require('pg');

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
    `);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
