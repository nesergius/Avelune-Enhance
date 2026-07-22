"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JobManager } = require("../src/job-manager");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("runs GPU jobs sequentially", async () => {
  const manager = new JobManager();
  const order = [];
  manager.enqueue("a", async () => { order.push("a-start"); await wait(20); order.push("a-end"); });
  manager.enqueue("b", async () => { order.push("b-start"); await wait(5); order.push("b-end"); });
  await wait(80);
  assert.deepEqual(order, ["a-start", "a-end", "b-start", "b-end"]);
});

test("cancels current job and clears queued jobs", async () => {
  const manager = new JobManager();
  let aborted = false;
  manager.enqueue("a", async ({ signal }) => new Promise((resolve) => {
    signal.addEventListener("abort", () => { aborted = true; resolve(); }, { once: true });
  }));
  manager.enqueue("b", async () => assert.fail("queued job should not run"));
  await wait(10);
  assert.ok(manager.cancelCurrent());
  assert.equal(manager.clearQueued(), 1);
  await wait(20);
  assert.equal(aborted, true);
});
