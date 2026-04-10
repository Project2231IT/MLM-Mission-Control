const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

const AUTH_USER = 'it@project2231.com';
const AUTH_PASS = 'Welcome@2231!';

const auth = basicAuth({
  users: { [AUTH_USER]: AUTH_PASS },
  challenge: true,
  realm: 'Mr. Crabs Dashboard'
});

// SSE clients need separate auth handling
const sseClients = [];
const authenticatedClients = new Set();

function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const activeSessions = new Map();

function validateSession(req, res, next) {
  const token = req.headers['x-session-token'];
  if (token && activeSessions.has(token) && activeSessions.get(token).expires > Date.now()) {
    req.user = activeSessions.get(token).user;
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

const app = express();
const PORT = 3800;
const WORKSPACE = '/home/jake/.openclaw/workspace';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Login endpoint - returns session token
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_USER && password === AUTH_PASS) {
    const token = generateSessionToken();
    activeSessions.set(token, {
      user: username,
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });
    return res.json({ token, user: username });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Logout endpoint
app.post('/api/logout', validateSession, (req, res) => {
  const token = req.headers['x-session-token'];
  activeSessions.delete(token);
  res.json({ success: true });
});

// SSE endpoint for real-time updates - uses session token via query param or header
app.get('/api/events', (req, res) => {
  const token = req.query.token || req.headers['x-session-token'];
  if (!token || !activeSessions.has(token) || activeSessions.get(token).expires <= Date.now()) {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseClients.push(res);

  // Send initial data
  broadcastUpdate();

  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index > -1) sseClients.splice(index, 1);
  });
});

function broadcastUpdate() {
  sseClients.forEach(client => {
    try {
      client.write('data: {"type":"update"}\n\n');
    } catch (err) {
      // Client disconnected
    }
  });
}

// Read core files
const CORE_FILES = [
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
  'MEMORY.md',
  'TOOLS.md',
  'HEARTBEAT.md'
];

// Apply session validation to all API routes (except login)
app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next(); // Skip auth for login
  const token = req.headers['x-session-token'];
  if (token && activeSessions.has(token) && activeSessions.get(token).expires > Date.now()) {
    return next();
  }
  if (req.method === 'GET' && req.path === '/events') {
    return res.status(401).end(); // SSE needs proper token
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

app.get('/api/core-files', async (req, res) => {
  try {
    const files = {};
    for (const filename of CORE_FILES) {
      const filepath = path.join(WORKSPACE, filename);
      try {
        const content = await fs.readFile(filepath, 'utf8');
        files[filename] = content;
      } catch (err) {
        files[filename] = null; // File doesn't exist
      }
    }
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent memory files (last 7 days)
app.get('/api/recent-memories', async (req, res) => {
  try {
    const memoryDir = path.join(WORKSPACE, 'memory');
    const entries = await fs.readdir(memoryDir, { withFileTypes: true });
    const mdFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.md') && e.name.startsWith('2026-'))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 7);

    const memories = {};
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(memoryDir, file.name), 'utf8');
      memories[file.name] = content;
    }
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent sessions (last 5)
app.get('/api/recent-sessions', async (req, res) => {
  try {
    const sessionsDir = path.join('/home/jake/.openclaw/agents/main/sessions');
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    const jsonlFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.jsonl'))
      .sort((a, b) => {
        const statA = require('fs').statSync(path.join(sessionsDir, a.name));
        const statB = require('fs').statSync(path.join(sessionsDir, b.name));
        return statB.mtime - statA.mtime;
      })
      .slice(0, 5);

    const sessions = [];
    for (const file of jsonlFiles) {
      const filepath = path.join(sessionsDir, file.name);
      const lines = (await fs.readFile(filepath, 'utf8')).split('\n').filter(l => l.trim());
      const firstLine = JSON.parse(lines[0]);
      const lastLine = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;

      sessions.push({
        id: file.name.replace('.jsonl', ''),
        started: firstLine.timestamp || 'unknown',
        lastActivity: lastLine?.timestamp || 'unknown',
        messages: lines.length,
        model: lastLine?.model || firstLine?.model || 'unknown'
      });
    }
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cron jobs
app.get('/api/cron', async (req, res) => {
  try {
    const result = require('child_process').execSync('crontab -l 2>/dev/null || echo "No cron jobs"');
    res.json({ crontab: result.toString().trim() });
  } catch (err) {
    res.json({ crontab: 'No cron jobs or cannot access' });
  }
});

// Get system status
app.get('/api/status', async (req, res) => {
  try {
    const uptime = require('os').uptime();
    const memory = process.memoryUsage();
    const [cpuInfo] = require('os').cpus();

    res.json({
      uptime: Math.floor(uptime / 3600) + 'h ' + Math.floor((uptime % 3600) / 60) + 'm',
      memory: {
        used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
      },
      cpu: cpuInfo.model,
      platform: process.platform,
      nodeVersion: process.version
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get integrations status
app.get('/api/integrations', async (req, res) => {
  try {
    const integrations = [
      {
        name: 'Wazuh Cluster',
        status: 'active',
        note: 'Indexer: 172.16.201.18, Manager: 172.16.201.19, Dashboard: 172.16.201.20',
        health: 'GREEN'
      },
      {
        name: 'Tactical RMM',
        status: 'active',
        note: 'rmm.project2231.com, 103 agents, 86 online',
        health: 'YELLOW'
      },
      {
        name: 'Argus AI / YOLO',
        status: 'active',
        note: 'Running on jakesopenclaw GPU (RTX 4060)',
        health: 'GREEN'
      },
      {
        name: 'WiFi Analytics',
        status: 'active',
        note: 'guest-analytics-app-1, guest-radius, postgres',
        health: 'GREEN'
      },
      {
        name: 'Portainer',
        status: 'active',
        note: '172.16.201.15:9443, guest-analytics stack',
        health: 'GREEN'
      },
      {
        name: 'LibreNMS',
        status: 'active',
        note: 'librenms.project2231.com, 22 devices',
        health: 'GREEN'
      },
      {
        name: 'ITFlow',
        status: 'active',
        note: 'helpdesk.project2231.com, ticketing',
        health: 'GREEN'
      }
    ];

    res.json(integrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get workspace structure
app.get('/api/workspace', async (req, res) => {
  try {
    const dirs = {};
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subdir = path.join(WORKSPACE, entry.name);
        try {
          const subentries = await fs.readdir(subdir);
          dirs[entry.name] = {
            type: 'directory',
            items: subentries.length,
            keyFiles: subentries.filter(f => f.endsWith('.md')).slice(0, 5)
          };
        } catch (err) {
          dirs[entry.name] = { type: 'directory', items: 0, keyFiles: [] };
        }
      }
    }

    res.json(dirs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast updates every 5 seconds for real-time feel
setInterval(broadcastUpdate, 5000);

// Manual refresh trigger endpoint
app.post('/api/refresh', (req, res) => {
  broadcastUpdate();
  res.json({ success: true, message: 'Refresh broadcasted' });
});

app.listen(PORT, () => {
  console.log(`🦀 Mr. Crabs Dashboard running at http://localhost:${PORT}`);
});
