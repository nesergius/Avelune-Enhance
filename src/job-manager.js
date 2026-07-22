"use strict";

const crypto = require("crypto");

class JobManager {
  constructor({ maxQueued = 32 } = {}) {
    this.maxQueued = maxQueued;
    this.queue = [];
    this.current = null;
    this.running = false;
  }

  enqueue(type, runner) {
    if (typeof runner !== "function") throw new TypeError("runner must be a function");
    if (this.queue.length >= this.maxQueued) throw new Error("Очередь задач заполнена.");
    const job = {
      id: crypto.randomUUID(),
      type,
      runner,
      controller: new AbortController(),
      createdAt: Date.now(),
      state: "queued"
    };
    this.queue.push(job);
    void this.#drain();
    return job.id;
  }

  cancelCurrent() {
    if (this.current) {
      this.current.state = "cancelling";
      this.current.controller.abort(new Error("Задача отменена пользователем."));
      return this.current.id;
    }
    return null;
  }

  clearQueued() {
    const removed = this.queue.splice(0);
    for (const job of removed) {
      job.state = "cancelled";
      job.controller.abort(new Error("Задача удалена из очереди."));
    }
    return removed.length;
  }

  getStatus() {
    return {
      current: this.current ? { id: this.current.id, type: this.current.type, state: this.current.state } : null,
      queued: this.queue.map((job) => ({ id: job.id, type: job.type, state: job.state }))
    };
  }

  async #drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (job.controller.signal.aborted) continue;
        this.current = job;
        job.state = "running";
        try {
          await job.runner({ id: job.id, signal: job.controller.signal });
          job.state = job.controller.signal.aborted ? "cancelled" : "completed";
        } catch (error) {
          job.state = job.controller.signal.aborted ? "cancelled" : "failed";
        } finally {
          this.current = null;
        }
      }
    } finally {
      this.running = false;
    }
  }
}

module.exports = { JobManager };
