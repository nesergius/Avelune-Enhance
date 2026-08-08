"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer/out/assets/app.css"), "utf8");

test("packaged UI probe follows the active sidebar design token", () => {
  assert.match(css, /--sidebar-width:\s*396px/);
  assert.match(main, /getPropertyValue\('--sidebar-width'\)/);
  assert.match(main, /Math\.abs\(sidebarBox\.width - declaredSidebarWidth\) <= 2/);
  assert.doesNotMatch(main, /sidebarBox\.width >= 320 && sidebarBox\.width <= 380/);
});

test("packaged UI probe keeps safe absolute sidebar bounds", () => {
  assert.match(main, /sidebarBox\.width >= 340/);
  assert.match(main, /sidebarBox\.width <= 410/);
});
