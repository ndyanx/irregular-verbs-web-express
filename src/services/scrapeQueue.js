/**
 * Queue with concurrency control and task deduplication for web scraping.
 * Uses SCRAPE_CONCURRENCY env var (default: 2) to limit concurrent requests.
 * 
 * Methods:
 * - enqueue(key, fn): Adds task to queue, deduplicates by key
 * - setConcurrency(n): Updates max concurrent tasks
 */
const PENDING_TASKS_BY_KEY = new Map();
class ScrapeQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 2);
    this.currentRunning = 0;
    this.queue = [];
  }

  /** Updates max concurrent tasks and processes queue */
  setConcurrency(n) {
    this.maxConcurrent = Math.max(1, Number(n) || 1);
    this._drain();
  }

  /** Processes tasks when there are available slots */
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

  /**
   * Adds a task to the queue, deduplicating by key
   * @returns {Promise} Existing promise if task with same key is pending
   */
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

// Initialize with concurrency from env or default to 2
const defaultConcurrency = process.env.SCRAPE_CONCURRENCY || 2;
const scrapeQueue = new ScrapeQueue(defaultConcurrency);

module.exports = {
  scrapeQueue,
  ScrapeQueue,
};


