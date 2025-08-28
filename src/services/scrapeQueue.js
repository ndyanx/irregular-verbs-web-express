// Cola con límite de concurrencia y deduplicación por clave para scrapers
// Útil para evitar scrapes duplicados y controlar presión sobre sitios externos
// Ajustable con la variable de entorno SCRAPE_CONCURRENCY
//
// API principal:
// - enqueue(key, fn): encola y deduplica por clave, devuelve una promesa del resultado
// - setConcurrency(n): cambia el límite de concurrencia en tiempo de ejecución
//
// Caso de uso en este proyecto: envolver el scraping cuando el caché no es válido
// para que múltiples pedidos de la misma palabra compartan el mismo trabajo.
 
// Mapa para deduplicar tareas por clave mientras estén en vuelo
const PENDING_TASKS_BY_KEY = new Map();

// Administra ejecución concurrente controlada de tareas asíncronas
// (en esencia, un semáforo simple con cola FIFO)
class ScrapeQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 2);
    this.currentRunning = 0;
    this.queue = [];
  }

  // Permite ajustar el límite de concurrencia en runtime
  setConcurrency(n) {
    this.maxConcurrent = Math.max(1, Number(n) || 1);
    this._drain();
  }

  // Ejecuta tareas mientras haya cupo disponible
  _drain() {
    while (this.currentRunning < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.currentRunning += 1;
      Promise.resolve()
        .then(task.run)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.currentRunning -= 1;
          this._drain();
        });
    }
  }

  // Deduplicate by key: if a task with same key is pending or running, return same promise
  // Encola una tarea y, si existe otra con la misma clave, devuelve la misma promesa
  enqueue(key, fn) {
    if (key && PENDING_TASKS_BY_KEY.has(key)) {
      return PENDING_TASKS_BY_KEY.get(key);
    }

    const promise = new Promise((resolve, reject) => {
      const run = async () => {
        try {
          const result = await fn();
          return result;
        } finally {
          if (key) PENDING_TASKS_BY_KEY.delete(key);
        }
      };
      this.queue.push({ run, resolve, reject });
      this._drain();
    });

    if (key) PENDING_TASKS_BY_KEY.set(key, promise);
    return promise;
  }
}

// Límite de concurrencia configurable vía env (por defecto 2)
const defaultConcurrency = process.env.SCRAPE_CONCURRENCY || 2;
const scrapeQueue = new ScrapeQueue(defaultConcurrency);

module.exports = {
  scrapeQueue,
  ScrapeQueue,
};


