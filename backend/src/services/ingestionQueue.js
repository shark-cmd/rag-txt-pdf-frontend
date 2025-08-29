import logger from '../config/logger.js';

class IngestionQueue {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
    this.queue = [];
    this.activeCount = 0;
  }

  async runNext() {
    if (this.activeCount >= this.concurrency) return;
    const next = this.queue.shift();
    if (!next) return;
    this.activeCount++;
    try {
      const result = await next.task();
      next.resolve(result);
    } catch (err) {
      next.reject(err);
    } finally {
      this.activeCount--;
      // Schedule the next task without deep recursion
      setImmediate(() => this.runNext());
    }
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.runNext();
    });
  }

  size() {
    return this.queue.length + this.activeCount;
  }
}

// Export a singleton queue for ingestion tasks
const defaultConcurrency = parseInt(process.env.INGEST_CONCURRENCY || '4', 10);
const ingestionQueue = new IngestionQueue(defaultConcurrency);

export default ingestionQueue;

