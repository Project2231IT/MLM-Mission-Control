const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb } = require('./utils/db');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');
const apiRoutes = require('./routes/api');
const portalRoutes = require('./routes/portal');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3700;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Portal routes - NO auth required (guests use these)
app.use('/portal', portalRoutes);

// Auth routes - NO auth required (login/logout)
app.use('/auth', authRoutes);

// Serve login page (public, no auth)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protect index.html and all other pages behind auth
app.get('/', (req, res) => {
  if (!req.session.authenticated && !req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  if (!req.session.authenticated && !req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static files - serve login assets and logos publicly, protect everything else
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/logos', express.static(path.join(__dirname, 'public', 'logos')));
app.use('/vendor', express.static(path.join(__dirname, 'public', 'vendor')));
app.use('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// All other static files require auth
app.use((req, res, next) => {
  if (req.session.authenticated || req.session.userId) {
    return express.static(path.join(__dirname, 'public'))(req, res, next);
  }
  res.redirect('/login');
});

// Routes (auth already mounted above)
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api', authMiddleware, apiRoutes);

async function start() {
  try {
    await initDb();
    console.log('Database initialized');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Guest WiFi Analytics running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
