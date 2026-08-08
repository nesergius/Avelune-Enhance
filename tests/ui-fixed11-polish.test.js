const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer/out/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer/out/assets/app.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'renderer/out/assets/app.js'), 'utf8');

test('FIXED11 themes native controls and replaces repeated profile thumbnails with a single before-after composition', () => {
  assert.match(css, /--control-menu-bg/);
  assert.match(css, /#local-ai-backend option/);
  assert.match(css, /profile-preview-before/);
  assert.match(css, /profile-preview-after/);
  assert.match(js, /<span class="profile-preview-divider" aria-hidden="true">/);
  assert.match(html, /Локальная обработка · проверенные модели/);
});

test('FIXED11 uses optically enlarged production logo in the navigation rail', () => {
  assert.match(css, /body\[data-active-view="enhance"\] \.brand-logo,[\s\S]*?body\.sidebar-compact\[data-active-view="enhance"\] \.brand-logo,[\s\S]*?\.sidebar\.collapsed \.brand-logo \{[\s\S]*?width: 44px !important;/);
  assert.match(css, /body\[data-active-view="enhance"\] \.brand-logo,[\s\S]*?height: 44px !important;/);
});

test('polished AI package cards use current design tokens and responsive layout', () => {
  assert.match(css, /--line: var\(--border-soft\);/);
  assert.match(css, /--surface-2: var\(--panel-soft\);/);
  assert.match(css, /\.local-ai-pack-status \{[\s\S]*?background: var\(--control-bg\);/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.local-ai-pack-status \{[\s\S]*?flex-direction: column;/);
});
