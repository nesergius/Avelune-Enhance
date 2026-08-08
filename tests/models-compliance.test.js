'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const baseModelFiles = [
  'avelune-standard-4x.bin',
  'avelune-standard-4x.param',
  'digital-art-4x.bin',
  'digital-art-4x.param'
];
const preparedOfficialFiles = [
  'realesrnet-x4plus.bin',
  'realesrnet-x4plus.param',
  'realesr-animevideov3-x2.bin',
  'realesr-animevideov3-x2.param',
  'realesr-animevideov3-x3.bin',
  'realesr-animevideov3-x3.param',
  'realesr-animevideov3-x4.bin',
  'realesr-animevideov3-x4.param'
];
const realEsrNetHashes = new Map([
  ['realesrnet-x4plus.bin', '26bccfcc82d9e8260c0c6b0dffb34ab297982740882d1f33c6d423f70b562c40'],
  ['realesrnet-x4plus.param', '35330ececcea33b6c397a72548e788d5d53becee4734c50b7fada36e89f10a86']
]);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
const removed = [
  'avelune-lite-4x',
  'high-fidelity-4x',
  'remacri-4x',
  'ultramix-balanced-4x',
  'ultrasharp-4x'
];

test('RC6 source contains either the pristine base set or the exact verified prepared model set', () => {
  const modelDir = path.join(root, 'resources', 'models');
  const files = fs.readdirSync(modelDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const pristineFiles = [...baseModelFiles].sort();
  const preparedFiles = [
    ...baseModelFiles,
    ...preparedOfficialFiles,
    'official-model-manifest.json'
  ].sort();

  if (files.length === pristineFiles.length) {
    assert.deepEqual(files, pristineFiles);
    return;
  }

  assert.deepEqual(files, preparedFiles);

  const manifestPath = path.join(modelDir, 'official-model-manifest.json');
  const manifestText = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.release, 'Real-ESRGAN NCNN official model set');
  assert.ok(Array.isArray(manifest.sources));
  assert.ok(Array.isArray(manifest.files));

  const expectedSources = new Set([
    'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
    'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.3.0/realesrgan-ncnn-vulkan-20211212-windows.zip'
  ]);
  assert.deepEqual(new Set(manifest.sources.map((entry) => entry.url)), expectedSources);

  const manifestByName = new Map(manifest.files.map((entry) => [entry.name, entry]));
  assert.deepEqual([...manifestByName.keys()].sort(), [...preparedOfficialFiles].sort());

  for (const name of preparedOfficialFiles) {
    const entry = manifestByName.get(name);
    assert.ok(entry, `Missing official manifest entry for ${name}`);
    assert.ok(expectedSources.has(entry.source), `Unexpected source URL for ${name}`);

    const modelPath = path.join(modelDir, name);
    const stat = fs.statSync(modelPath);
    assert.equal(entry.bytes, stat.size, `Size mismatch for ${name}`);
    assert.equal(entry.sha256, sha256(modelPath), `SHA-256 mismatch for ${name}`);

    if (realEsrNetHashes.has(name)) {
      assert.equal(entry.sha256, realEsrNetHashes.get(name), `Pinned RealESRNet hash mismatch for ${name}`);
      assert.match(entry.source, /v0\.2\.3\.0/);
    } else {
      assert.match(entry.source, /v0\.2\.5\.0/);
    }
  }
});

test('removed model weights are absent from built-in allowlist and interface choices', () => {
  const constants = fs.readFileSync(path.join(root, 'src', 'constants.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'out', 'index.html'), 'utf8');
  for (const id of removed) {
    assert.doesNotMatch(constants, new RegExp(`"${id}"`));
    assert.doesNotMatch(html, new RegExp(`value="${id}"|data-model="${id}"`));
  }
});

test('removed model settings are migrated to a verified fallback', () => {
  const app = fs.readFileSync(path.join(root, 'renderer', 'out', 'assets', 'app.js'), 'utf8');
  for (const id of removed) {
    assert.match(app, new RegExp(`"${id}"`));
  }
  assert.match(app, /REMOVED_MODEL_FALLBACKS/);
});

test('model provenance and binary build include licenses', () => {
  const provenance = fs.readFileSync(path.join(root, 'MODEL_PROVENANCE.md'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(provenance, /Версия:\s*\*\*2\.0\.0 RC6\*\*/);
  assert.ok(pkg.build.files.includes('licenses/**/*'));
  assert.ok(fs.existsSync(path.join(root, 'licenses', 'REAL-ESRGAN-BSD-3-Clause.txt')));
  assert.ok(fs.existsSync(path.join(root, 'licenses', 'NCNN-LICENSE.txt')));
  assert.ok(fs.existsSync(path.join(root, 'licenses', 'LIBWEBP-COPYING.txt')));
});
