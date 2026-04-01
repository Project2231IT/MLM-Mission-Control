const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { pool } = require('../utils/db');
const { parseCustomField, parseApName, ssidToLocation } = require('../utils/parser');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ext === '.xlsx' || ext === '.xls');
}});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid XLSX file uploaded' });

  const client = await pool.connect();
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let imported = 0, newGuests = 0, returningGuests = 0;

    await client.query('BEGIN');

    for (const row of rows) {
      const customField = row['Custom field'] || '';
      const parsed = parseCustomField(customField);
      
      // Also check the Email column directly
      const directEmail = row['Email'] || '';
      const email = parsed.email || (directEmail ? directEmail.toLowerCase().trim() : null);
      
      if (!email) continue; // Skip rows without email

      const ssid = row['SSID'] || '';
      const locationCode = ssidToLocation(ssid);
      const apName = parseApName(row['Device'] || '');
      const mac = row['MAC'] || '';
      const hostname = row['Hostname'] || '';
      const visitCount = parseInt(row['Visit count']) || 1;
      const rssi = parseInt(row['RSSI']) || null;
      const authMethod = row['Last authentication method'] || '';

      // Parse dates
      let startTime = null, expireTime = null;
      try {
        if (row['Start time']) {
          startTime = parseDate(row['Start time']);
        }
        if (row['Expire time']) {
          expireTime = parseDate(row['Expire time']);
        }
      } catch (e) { /* ignore date parse errors */ }

      // Upsert guest
      const guestResult = await client.query(`
        INSERT INTO guests (email, first_name, last_name, mobile_phone, age, first_seen, last_seen, total_visits)
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), guests.first_name),
          last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), guests.last_name),
          mobile_phone = COALESCE(NULLIF(EXCLUDED.mobile_phone, ''), guests.mobile_phone),
          age = COALESCE(NULLIF(EXCLUDED.age, ''), guests.age),
          last_seen = GREATEST(guests.last_seen, EXCLUDED.last_seen),
          first_seen = LEAST(guests.first_seen, EXCLUDED.first_seen),
          total_visits = guests.total_visits + $7
        RETURNING id, (xmax = 0) AS is_new
      `, [email, parsed.firstName, parsed.lastName, parsed.mobilePhone, parsed.age,
          startTime || new Date(), visitCount]);

      const guestId = guestResult.rows[0].id;
      const isNew = guestResult.rows[0].is_new;

      if (isNew) newGuests++;
      else returningGuests++;

      // Check for duplicate visit (same guest, same start_time, same ssid)
      const dupCheck = await client.query(`
        SELECT id FROM visits WHERE guest_id = $1 AND start_time = $2 AND ssid = $3
      `, [guestId, startTime, ssid]);

      if (dupCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO visits (guest_id, mac, hostname, start_time, expire_time, visit_count, device, ap_name, ssid, location_code, rssi, auth_method, raw_custom_field)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [guestId, mac, hostname, startTime, expireTime, visitCount,
            row['Device'] || '', apName, ssid, locationCode, rssi, authMethod, customField]);
      }

      imported++;
    }

    // Log upload
    await client.query(`
      INSERT INTO uploads (filename, rows_imported, new_guests, returning_guests)
      VALUES ($1, $2, $3, $4)
    `, [req.file.originalname, imported, newGuests, returningGuests]);

    await client.query('COMMIT');

    // Clean up file
    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      filename: req.file.originalname,
      rowsImported: imported,
      newGuests,
      returningGuests,
      totalRows: rows.length,
      skipped: rows.length - imported,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process file: ' + err.message });
  } finally {
    client.release();
  }
});

function parseDate(val) {
  if (!val) return null;
  // Handle Excel serial dates
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Get upload history
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM uploads ORDER BY uploaded_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
