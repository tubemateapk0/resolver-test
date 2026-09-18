type QueueEntry = {
  resolve: () => void;
  timestamp: number;
};

export class ConcurrencyLimiter {
  private running = 0;
  private queue: QueueEntry[] = [];
  private readonly maxConcurrent: number;
  private readonly queueTimeout: number;

  constructor(maxConcurrent: number, queueTimeout = 30000) {
    this.maxConcurrent = maxConcurrent;
    this.queueTimeout = queueTimeout;
  }

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve,
        timestamp: Date.now(),
      };
      this.queue.push(entry);

      const timeout = setTimeout(() => {
        const index = this.queue.indexOf(entry);
        if (index >= 0) {
          this.queue.splice(index, 1);
          reject(new Error("resolve queue timeout"));
        }
      }, this.queueTimeout);

      const originalResolve = entry.resolve;
      entry.resolve = () => {
        clearTimeout(timeout);
        originalResolve();
      };
    });
  }

  release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next.resolve();
      }
    }
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}
