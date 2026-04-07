# WiFi Analytics — Telegram Topic 2795

**Topic link:** https://t.me/c/3817641801/2795
**Created:** 2026-04-07

---

## Guest WiFi Analytics — Full Overview

### Access
- **Dashboard:** `http://172.16.201.15:3700`
- **Public URL:** `wifi.project2231.com`
- **Login:** `admin` / `P2231Guest@Admin`
- **Portainer:** `172.16.201.15:9443` — API key: `ptr_H1eEPHCGkzLnOkjW6mLQM2Fb1YjHYOjz+7DziKmyycA=`

### Stack
- **App:** Node.js/Express + Tailwind CSS + Chart.js
- **Database:** PostgreSQL 16 (`guestadmin` / `GuestWifi2024!Secure`)
- **Container:** `guest-analytics-app-1` on Portainer (endpoint ID 2, stack ID 203)
- **Port:** 3700

### Locations Tracked
| Code | Business | SSID |
|------|----------|------|
| TCF | The City Forum | The City Forum Guest |
| D17 | Dock 17 | Dock17 Guest |
| ACME | ACME | ACME Guest Wifi |
| MLC | Miss Lucilles | Miss Lucilles Guest Wifi |

### Features
- XLSX drag-and-drop upload (Grandstream GWN Cloud weekly exports)
- Guest deduplication by email
- Return visit tracking across weeks
- Cross-location visitor identification
- KPIs, charts (location breakdown, new/returning, peak times, age demographics)
- Filtered CSV export for marketing

### Data Flow
Grandstream GWN Cloud → weekly XLSX export → upload to dashboard → parsed and deduped by email into PostgreSQL

**Custom field format** (from GWN Cloud): `Email, First Name, Last Name, Mobile Phone, Age`

---

## FreeRADIUS Container

**Container:** `guest-radius`
**Image:** `freeradius/freeradius-server:latest`
**Status:** Running (PID 940147, since 2026-04-02)
**Network:** Host mode — binds directly to host interfaces
**Ports:** 1812/udp (auth), 1813/udp (accounting)
**RADIUS Secret:** `P2231GuestRadius2026`

### Allowed RADIUS Clients
- `172.16.15.0/24` — Grandstream APs
- `127.0.0.1` — localhost
- `172.16.0.0/12` — Docker networks

### Config Location
`/home/jake/.openclaw/workspace/guest-wifi-analytics/freeradius/`
- `Dockerfile` — builds the image
- `clients.conf` — RADIUS client ACLs
- `authorize` — user authorization rules
- `mods-enabled/sql` — PostgreSQL SQL module config

### Useful Commands
```bash
# Exec into container
docker exec -it guest-radius sh

# Debug mode (real-time logs)
docker exec -it guest-radius freeradius -X

# Reload config without restart
docker exec guest-radius radiusd - reload

# Rebuild & redeploy (after config changes)
cd /home/jake/.openclaw/workspace/guest-wifi-analytics
docker-compose -f freeradius/docker-compose.yml build
docker-compose -f freeradius/docker-compose.yml up -d
```

### GWN Cloud Integration
- GWN Cloud uses external captive portal (EXCAP) flow
- Splash URL: `http://172.16.201.15:3700/portal/splash/{code}` (internal IP, HTTP)
- Firewall: VLAN 18 → 172.16.201.15:3700 (captive portal pinhole)
- NPM Force SSL must be OFF for wifi.project2231.com (captive portal needs HTTP)
- FreeRADIUS config requires:
  - `require_message_authenticator=no`
  - `limit_proxy_state=no`

---

## Source
`/home/jake/.openclaw/workspace/guest-wifi-analytics/` on jakesopenclaw
