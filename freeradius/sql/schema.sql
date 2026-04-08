-- RADIUS Accounting Schema
-- Tables for capturing Acct-Start/Acct-Stop/Acct-Update packets from FreeRADIUS

CREATE TABLE IF NOT EXISTS radius_accounting (
  id SERIAL PRIMARY KEY,
  acct_session_id VARCHAR(64),
  acct_unique_id VARCHAR(64) UNIQUE,
  username VARCHAR(255),
  realm VARCHAR(255),
  nas_ip_address VARCHAR(45),
  nas_port_id VARCHAR(255),
  nas_port_type VARCHAR(50),
  start_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  acct_interval INTEGER,
  acct_session_time INTEGER,
  acct_authentic VARCHAR(50),
  connection_info_start TEXT,
  connection_info_stop TEXT,
  acquired_ip VARCHAR(45),
  calling_station_id VARCHAR(50),
  called_station_id VARCHAR(50),
  acct_start_downstream INTEGER,
  acct_start_upstream INTEGER,
  acct_stop_downstream INTEGER,
  acct_stop_upstream INTEGER,
  acct_input_packets BIGINT,
  acct_output_packets BIGINT,
  acct_terminate_cause VARCHAR(50),
  service_type VARCHAR(50),
  framed_protocol VARCHAR(50),
  framed_ip_address VARCHAR(45),
  mac_address VARCHAR(50),
  ap_mac VARCHAR(50),
  ssid VARCHAR(255),
  location_code VARCHAR(10),
  CONSTRAINT username_nas_ip_unique UNIQUE (username, nas_ip_address, start_time)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_radius_acct_username ON radius_accounting(username);
CREATE INDEX IF NOT EXISTS idx_radius_acct_start_time ON radius_accounting(start_time);
CREATE INDEX IF NOT EXISTS idx_radius_acct_stop_time ON radius_accounting(stop_time);
CREATE INDEX IF NOT EXISTS idx_radius_acct_mac ON radius_accounting(mac_address);
CREATE INDEX IF NOT EXISTS idx_radius_acct_ssid ON radius_accounting(ssid);
CREATE INDEX IF NOT EXISTS idx_radius_acct_location ON radius_accounting(location_code);
CREATE INDEX IF NOT EXISTS idx_radius_acct_terminate ON radius_accounting(acct_terminate_cause);

-- Guest session derived view (combines radius accounting with portal registrations)
CREATE OR REPLACE VIEW guest_sessions AS
SELECT
  ra.acct_session_id,
  ra.username,
  ra.mac_address,
  ra.ap_mac,
  ra.ssid,
  ra.location_code,
  ra.start_time,
  ra.stop_time,
  EXTRACT(EPOCH FROM (ra.stop_time - ra.start_time))::INTEGER AS duration_seconds,
  ra.acct_input_packets AS input_packets,
  ra.acct_output_packets AS output_packets,
  ra.acct_terminate_cause,
  g.email,
  g.first_name,
  g.last_name,
  g.id AS guest_id,
  CASE WHEN ra.stop_time IS NOT NULL THEN false ELSE true END AS active_session
FROM radius_accounting ra
LEFT JOIN guests g ON ra.username = g.email OR ra.mac_address IN (SELECT mac FROM mac_addresses WHERE guest_id = g.id)
WHERE ra.username IS NOT NULL AND ra.username != '';