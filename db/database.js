const Database = require('better-sqlite3');
const path = require('path');

// Dynamic country loader — falls back to 'be' for unknown values
const SUPPORTED_COUNTRIES = [
  'be','nl','de','fr','es','it','ch','at',
  'dk','pl','no','fi','se','gb','ie','pt','us','ca'
];
const countryCode = (process.env.COUNTRY || 'BE').toLowerCase();
const resolvedCode = SUPPORTED_COUNTRIES.includes(countryCode) ? countryCode : 'be';

let MEDICINES, CATEGORIES;
try {
  ({ MEDICINES, CATEGORIES } = require(`../data/countries/${resolvedCode}`));
  console.log(`🌍 Country database loaded: ${resolvedCode.toUpperCase()} — ${MEDICINES.length} medicines`);
} catch (err) {
  console.warn(`⚠️  Could not load country file '${resolvedCode}', falling back to BE`);
  ({ MEDICINES, CATEGORIES } = require('../data/countries/be'));
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/apohouze.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb();
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS medicine_db (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generic TEXT,
      category TEXT NOT NULL,
      form TEXT,
      rx INTEGER DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generic TEXT,
      category TEXT NOT NULL,
      form TEXT,
      quantity INTEGER DEFAULT 1,
      unit TEXT DEFAULT 'units',
      expiry_date DATE,
      notes TEXT,
      location TEXT DEFAULT 'Medicine cabinet',
      rx INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER,
      alert_type TEXT NOT NULL,
      alert_date DATE,
      message TEXT,
      resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Always reload medicine_db when country changes or count mismatches
  const storedCountry = db.prepare("SELECT value FROM app_config WHERE key = 'country'").get();
  const storedCount   = db.prepare("SELECT value FROM app_config WHERE key = 'medicine_count'").get();
  const countryChanged = !storedCountry || storedCountry.value !== resolvedCode;
  const countChanged   = !storedCount   || parseInt(storedCount.value) !== MEDICINES.length;

  if (countryChanged || countChanged) {
    console.log(`🔄 Reloading medicine DB: country=${resolvedCode.toUpperCase()} (${MEDICINES.length} medicines)`);
    db.prepare('DELETE FROM medicine_db').run();
    const insert = db.prepare(
      'INSERT INTO medicine_db (name, generic, category, form, rx) VALUES (@name, @generic, @category, @form, @rx)'
    );
    const insertMany = db.transaction((meds) => {
      for (const m of meds) {
        insert.run({
          name: m.name,
          generic: m.generic || '',
          category: m.category,
          form: m.form || '',
          rx: m.rx ? 1 : 0
        });
      }
    });
    insertMany(MEDICINES);
    db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('country', ?)").run(resolvedCode);
    db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('medicine_count', ?)").run(String(MEDICINES.length));
    console.log(`✅ Medicine database synced: ${MEDICINES.length} medicines (${resolvedCode.toUpperCase()})`);
  } else {
    console.log(`✅ Medicine database up to date: ${MEDICINES.length} medicines (${resolvedCode.toUpperCase()})`);
  }
}

function searchMedicines(query, limit = 15) {
  const db = getDb();
  const q = `%${query}%`;
  return db.prepare(`
    SELECT name, generic, category, form, rx 
    FROM medicine_db 
    WHERE name LIKE ? OR generic LIKE ?
    ORDER BY 
      CASE WHEN name LIKE ? THEN 0 ELSE 1 END,
      name ASC
    LIMIT ?
  `).all(q, q, `${query}%`, limit);
}

function getCategoryStats() {
  const db = getDb();
  return db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM inventory 
    GROUP BY category 
    ORDER BY category
  `).all();
}

function getInventory(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters.search) {
    query += ' AND (name LIKE ? OR generic LIKE ? OR notes LIKE ?)';
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  if (filters.expiring) {
    query += ' AND expiry_date IS NOT NULL AND expiry_date <= date("now", "+30 days")';
  }

  query += ' ORDER BY expiry_date ASC, name ASC';
  return db.prepare(query).all(...params);
}

function addInventoryItem(item) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO inventory (name, generic, category, form, quantity, unit, expiry_date, notes, location, rx)
    VALUES (@name, @generic, @category, @form, @quantity, @unit, @expiry_date, @notes, @location, @rx)
  `);
  const result = stmt.run(item);
  return result.lastInsertRowid;
}

function updateInventoryItem(id, item) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE inventory SET
      name = @name,
      generic = @generic,
      category = @category,
      form = @form,
      quantity = @quantity,
      unit = @unit,
      expiry_date = @expiry_date,
      notes = @notes,
      location = @location,
      rx = @rx,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);
  return stmt.run({ ...item, id });
}

function deleteInventoryItem(id) {
  const db = getDb();
  return db.prepare('DELETE FROM inventory WHERE id = ?').run(id);
}

function getDashboardStats() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  return {
    total: db.prepare('SELECT COUNT(*) as c FROM inventory').get().c,
    expired: db.prepare('SELECT COUNT(*) as c FROM inventory WHERE expiry_date IS NOT NULL AND expiry_date < ?').get(today).c,
    expiring30: db.prepare('SELECT COUNT(*) as c FROM inventory WHERE expiry_date IS NOT NULL AND expiry_date >= ? AND expiry_date <= ?').get(today, in30).c,
    expiring90: db.prepare('SELECT COUNT(*) as c FROM inventory WHERE expiry_date IS NOT NULL AND expiry_date > ? AND expiry_date <= ?').get(in30, in90).c,
    categories: db.prepare('SELECT COUNT(DISTINCT category) as c FROM inventory').get().c,
    rx: db.prepare('SELECT COUNT(*) as c FROM inventory WHERE rx = 1').get().c,
    country: resolvedCode.toUpperCase(),
    medicineDbCount: MEDICINES.length,
  };
}

function getExpiringItems(days = 30) {
  const db = getDb();
  const future = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM inventory 
    WHERE expiry_date IS NOT NULL AND expiry_date <= ? 
    ORDER BY expiry_date ASC
  `).all(future);
}

module.exports = {
  getDb,
  searchMedicines,
  getCategoryStats,
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getDashboardStats,
  getExpiringItems,
  CATEGORIES,
};
