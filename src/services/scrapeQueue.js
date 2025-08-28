const PENDING_TASKS_BY_KEY = new Map();

// Concurrency-limited queue using a simple token bucket
class ScrapeQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 2);
    this.currentRunning = 0;
    this.queue = [];
  }

  setConcurrency(n) {
    this.maxConcurrent = Math.max(1, Number(n) || 1);
    this._drain();
  }

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

const defaultConcurrency = process.env.SCRAPE_CONCURRENCY || 2;
const scrapeQueue = new ScrapeQueue(defaultConcurrency);

module.exports = {
  scrapeQueue,
  ScrapeQueue,
};


