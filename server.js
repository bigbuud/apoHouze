const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  getDb,
  searchMedicines,
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getDashboardStats,
  getExpiringItems,
  CATEGORIES,
} = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

const APP_USERNAME = process.env.APP_USERNAME || 'admin';
const APP_PASSWORD = process.env.APP_PASSWORD || 'apohouze123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'apohouze-secret-change-this';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true when running behind HTTPS reverse proxy
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Not logged in' });
}

// ==================== AUTH ====================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === APP_USERNAME && password === APP_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ success: true, username });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== CONFIG (country info) ====================
app.get('/api/config', requireAuth, (req, res) => {
  const stats = getDashboardStats();
  res.json({
    country: stats.country,
    medicineDbCount: stats.medicineDbCount,
  });
});

// ==================== DASHBOARD ====================
app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const stats = getDashboardStats();
    const expiring = getExpiringItems(90);
    const today = new Date().toISOString().split('T')[0];
    res.json({ stats, expiring, today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MEDICINES AUTOCOMPLETE ====================
app.get('/api/medicines/search', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const results = searchMedicines(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/categories', requireAuth, (req, res) => {
res.json(CATEGORIES.map(c => (typeof c === 'object' && c !== null ? c.name : c)));
});

// ==================== INVENTORY ====================
app.get('/api/inventory', requireAuth, (req, res) => {
  try {
    const { category, search, expiring } = req.query;
    const items = getInventory({ category, search, expiring: expiring === '1' });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', requireAuth, (req, res) => {
  try {
    const item = {
      name: req.body.name,
      generic: req.body.generic || '',
      category: req.body.category,
      form: req.body.form || '',
      quantity: parseInt(req.body.quantity) || 1,
      unit: req.body.unit || 'units',
      expiry_date: req.body.expiry_date || null,
      notes: req.body.notes || '',
      location: req.body.location || 'Medicine cabinet',
      rx: req.body.rx ? 1 : 0,
    };
    const id = addInventoryItem(item);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = {
      name: req.body.name,
      generic: req.body.generic || '',
      category: req.body.category,
      form: req.body.form || '',
      quantity: parseInt(req.body.quantity) || 1,
      unit: req.body.unit || 'units',
      expiry_date: req.body.expiry_date || null,
      notes: req.body.notes || '',
      location: req.body.location || 'Medicine cabinet',
      rx: req.body.rx ? 1 : 0,
    };
    updateInventoryItem(id, item);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/inventory/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    deleteInventoryItem(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EXPIRING ====================
app.get('/api/expiring', requireAuth, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const items = getExpiringItems(days);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update status — shows when the medicine DB was last updated
app.get('/api/update-status', requireAuth, (req, res) => {
  try {
    const logPath = path.join(__dirname, 'data', 'last-update.json');
    if (!require('fs').existsSync(logPath)) {
      return res.json({ last_update: null, total_added: 0, message: 'No update log found.' });
    }
    const log = require(logPath);
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

try {
  getDb();
  console.log('✅ Database initialized');
} catch (err) {
  console.error('❌ Database error:', err);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💊 apoHouze PWA running on port ${PORT}`);
  console.log(`👤 Login: ${APP_USERNAME} / ${APP_PASSWORD}`);
});
