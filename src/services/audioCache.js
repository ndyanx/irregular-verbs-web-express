const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '../cache.json');

let memoryCache = {};

// Cargar cache desde archivo al iniciar
function loadCacheFromFile() {
  try {
    const rawData = fs.readFileSync(CACHE_PATH, 'utf-8');
    memoryCache = JSON.parse(rawData);
    console.log('[CACHE] Cargado cache desde archivo');
  } catch (err) {
    memoryCache = {};
    console.log('[CACHE] Archivo vacío o no existente, creando nuevo cache');
  }
}

// Guardar cache actual a disco
function saveCacheToFile() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(memoryCache, null, 2), 'utf-8');
  console.log('[CACHE] Guardado cache en archivo');
}

function getFromCache(word, accent) {
  return memoryCache[word]?.[accent] || null;
}

function setToCache(word, accent, audioUrl) {
  if (!memoryCache[word]) memoryCache[word] = {};
  memoryCache[word][accent] = audioUrl;
  saveCacheToFile(); // Guardamos solo al escribir
}

module.exports = {
  loadCacheFromFile,
  getFromCache,
  setToCache
};
