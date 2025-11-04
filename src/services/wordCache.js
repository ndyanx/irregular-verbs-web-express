const logger = require('pino')();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuración de directorio para la base de datos
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Inicialización de SQLite con WAL para mejor concurrencia
const db = new Database(path.join(dbDir, 'cache.db'));
db.pragma('journal_mode = WAL');

db.prepare(`
  CREATE TABLE IF NOT EXISTS cache (
    word TEXT PRIMARY KEY,
    json TEXT NOT NULL
  )
`).run();

// Consultas preparadas para mejor rendimiento
const getStmt = db.prepare('SELECT json FROM cache WHERE word = ?');
const insertStmt = db.prepare('INSERT OR REPLACE INTO cache (word, json) VALUES (?, ?)');

/**
 * Obtiene datos de una palabra desde la caché
 */
async function getFromCache(word) {
  try {
    const row = getStmt.get(word);
    return row ? JSON.parse(row.json) : null;
  } catch (err) {
    logger.error('Cache read error:', err);
    return null;
  }
}

/**
 * Stores word data in cache
 * @param {string} word - Word to store
 * @param {Object} fullData - Data to cache (will be JSON stringified)
 */
async function setToCache(word, fullData) {
  try {
    insertStmt.run(word, JSON.stringify(fullData));
  } catch (err) {
    logger.error('Cache write error:', err);
    throw err;
  }
}

/**
 * Exports entire cache to a JSON file
 * @param {string} filePath - Path to export file (default: './data/cache_export.json')
 * @returns {Promise<void>}
 */
async function exportCacheToFile(filePath = path.join(dbDir, 'cache_export.json')) {
  try {
    const cacheData = {};
    const rows = db.prepare('SELECT word, json FROM cache').all();
    
    rows.forEach(row => {
      try {
        cacheData[row.word] = JSON.parse(row.json);
      } catch (e) {
        logger.warn(`Invalid JSON for ${row.word}`, e);
      }
    });
    
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    logger.info(`Cache exported to ${path.basename(filePath)}`);
  } catch (err) {
    logger.error('Export failed:', err);
    throw err;
  }
}

/**
 * Closes database connection
 * Should be called on application shutdown
 */
function closeConnection() {
  db.close();
}

// Manejo de cierre limpio
process.on('SIGINT', () => {
  logger.info('Closing database...');
  closeConnection();
  process.exit(0);
});

module.exports = {
  getFromCache,
  setToCache,
  exportCacheToFile,
  closeConnection,
};
