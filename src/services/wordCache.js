const logger = require('pino')()

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_PG_URL,
  ssl: true
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS cache (
    word TEXT PRIMARY KEY,
    json JSONB NOT NULL
  )
`;

// const createTableQuery = `
//   DROP TABLE IF EXISTS cache
// `;

pool.query(createTableQuery, (err, res) => {
  if (err) {
    logger.error('Error al crear la tabla:', err.stack);
  } else {
    logger.info('Tabla "cache" creada o ya existe');
  }
});

function getFromCache(word) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT json FROM cache WHERE word = $1';
    pool.query(query, [word], (err, res) => {
      if (err) {
        reject(err);
      } else {
        const row = res.rows[0];
        resolve(row ? row.json : null);
      }
    });
  });
}

function setToCache(word, fullData) {
  const jsonString = JSON.stringify(fullData);
  return new Promise((resolve, reject) => {
    const query = 'INSERT INTO cache (word, json) VALUES ($1, $2) ON CONFLICT (word) DO UPDATE SET json = EXCLUDED.json';
    pool.query(query, [word, jsonString], (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

function exportCacheToFile(filePath = path.join(__dirname, '../data/cache.json')) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT word, json FROM cache';
    pool.query(query, (err, res) => {
      if (err) {
        reject(err);
      } else {
        const cacheData = {};
        res.rows.forEach(row => {
          cacheData[row.word] = row.json;
        });
        fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');
        logger.info(`[CACHE] Exportado a ${filePath}`);
        resolve();
      }
    });
  });
}

function closeConnection() {
  pool.end();
}

module.exports = {
  getFromCache,
  setToCache,
  exportCacheToFile,
  closeConnection,
};
