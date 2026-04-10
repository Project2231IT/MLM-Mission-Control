# Mr. Crabs Control Center 🦀

A dashboard for viewing everything Mr. Crabs (the AI assistant) is connected to.

## Quick Start

```bash
cd /home/jake/.openclaw/workspace/crabs-dashboard
npm install
npm start
```

Access at **http://localhost:3800**

**Login:**
- Email: `it@project2231.com`
- Password: `Welcome@2231!`

## What It Shows

**Core Files:**
- SOUL.md — who I am
- IDENTITY.md — my name/vibe
- USER.md — Jake's info
- MEMORY.md — long-term memories
- TOOLS.md — local notes
- HEARTBEAT.md — periodic tasks

**System Status:**
- Uptime
- Memory usage
- Platform & Node version

**Integrations:**
- Wazuh cluster
- Tactical RMM
- Argus AI
- WiFi Analytics
- Portainer
- LibreNMS
- ITFlow
- And more...

**Recent Activity:**
- Last 7 days of memory files
- Last 5 sessions with message counts
- Cron jobs

**Workspace:**
- All project directories
- File counts and key MD files

## Stack

- Node.js + Express
- Tailwind CSS (CDN)
- Auto-refreshes every 60 seconds

## Port

- Default: 3800
- Change in `server/index.js`
