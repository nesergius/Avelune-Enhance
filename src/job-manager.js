"use strict";

const crypto = require("crypto");

class JobManager {
  constructor({ maxQueued = 32 } = {}) {
    this.maxQueued = maxQueued;
    this.queue = [];
    this.current = null;
    this.running = false;
  }

  enqueue(type, runner, { id = crypto.randomUUID(), metadata = null } = {}) {
    if (typeof runner !== "function") throw new TypeError("runner must be a function");
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Некорректный идентификатор задачи.");
    if (this.current?.id === id || this.queue.some((job) => job.id === id)) throw new Error("Задача с таким идентификатором уже существует.");
    if (this.queue.length >= this.maxQueued) throw new Error("Очередь задач заполнена.");
    const job = {
      id,
      type,
      runner,
      metadata,
      controller: new AbortController(),
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      state: "queued"
    };
    this.queue.push(job);
    void this.#drain();
    return job.id;
  }

  cancel(id, reason = "Задача отменена пользователем.") {
    if (typeof id !== "string" || !id) return false;
    if (this.current?.id === id) {
      this.current.state = "cancelling";
      this.current.controller.abort(new Error(reason));
      return true;
    }
    const index = this.queue.findIndex((job) => job.id === id);
    if (index < 0) return false;
    const [job] = this.queue.splice(index, 1);
    job.state = "cancelled";
    job.finishedAt = Date.now();
    job.controller.abort(new Error(reason));
    return true;
  }

  cancelAll(reason = "Работа приложения завершена.") {
    let count = 0;
    if (this.current && !this.current.controller.signal.aborted) {
      this.current.state = "cancelling";
      this.current.controller.abort(new Error(reason));
      count += 1;
    }
    for (const job of this.queue.splice(0)) {
      job.state = "cancelled";
      job.finishedAt = Date.now();
      job.controller.abort(new Error(reason));
      count += 1;
    }
    return count;
  }

  getStatus() {
    const compact = (job) => job ? {
      id: job.id,
      type: job.type,
      state: job.state,
      createdAt: job.createdAt,
      startedAt: job.startedAt
    } : null;
    return {
      current: compact(this.current),
      queued: this.queue.map(compact)
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
        job.startedAt = Date.now();
        try {
          await job.runner({ id: job.id, type: job.type, signal: job.controller.signal, metadata: job.metadata });
          job.state = job.controller.signal.aborted ? "cancelled" : "completed";
        } catch {
          job.state = job.controller.signal.aborted ? "cancelled" : "failed";
        } finally {
          job.finishedAt = Date.now();
          this.current = null;
        }
      }
    } finally {
      this.running = false;
      if (this.queue.length > 0) void this.#drain();
    }
  }
}

module.exports = { JobManager };
