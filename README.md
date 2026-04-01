# Guest WiFi Analytics

Analytics dashboard for Project2231 guest WiFi data from Grandstream GWN Cloud exports.

## Quick Start

```bash
docker-compose up -d --build
```

Access at **http://localhost:3700**

**Login:** `admin` / `P2231Guest@Admin`

## Features

- **XLSX Upload** — Drag & drop Grandstream GWN Cloud weekly exports
- **Guest Database** — PostgreSQL with dedup by email
- **Return Visit Tracking** — Tracks guests across weekly imports
- **Cross-Location Tracking** — Identifies guests visiting multiple P2231 businesses
- **Dashboard** — KPIs, charts (location breakdown, new/returning ratio, peak times, age demographics)
- **Marketing Export** — CSV export filtered by location, date range, guest type

## Locations

| Code | Business | SSID |
|------|----------|------|
| TCF | The City Forum | The City Forum Guest |
| D17 | Dock 17 | Dock17 Guest |
| ACME | ACME | ACME Guest Wifi |
| MLC | Miss Lucilles | Miss Lucilles Guest Wifi |

## Architecture

- **Backend:** Node.js + Express
- **Frontend:** Tailwind CSS + Chart.js + Vanilla JS
- **Database:** PostgreSQL 16
- **Port:** 3700

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3700 | App port |
| DB_HOST | postgres | Database host |
| DB_PORT | 5432 | Database port |
| DB_NAME | guest_wifi | Database name |
| DB_USER | guestadmin | Database user |
| DB_PASSWORD | GuestWifi2024!Secure | Database password |
| SESSION_SECRET | (set in compose) | Express session secret |
| ADMIN_USER | admin | Login username |
| ADMIN_PASS | P2231Guest@Admin | Login password |

## Data Format

Expects XLSX exports from Grandstream GWN Cloud with columns:
MAC, Hostname, Start time, Expire time, Visit count, Device, SSID, RSSI, Last authentication method, Facebook, Twitter, Custom field, Radius, Voucher, Payment, Google, SMS, Email, Active Directory

The "Custom field" column is parsed for: Email, First Name, Last Name, Mobile Phone, Age.
