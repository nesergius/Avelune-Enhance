"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePng, parseJpeg, parseWebp } = require("../src/image-info");

test("parses PNG dimensions", () => {
  const b = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(b, 0);
  b.writeUInt32BE(640, 16);
  b.writeUInt32BE(360, 20);
  assert.deepEqual(parsePng(b), { format: "png", width: 640, height: 360 });
});

test("parses baseline JPEG dimensions", () => {
  const b = Buffer.from([0xff,0xd8, 0xff,0xc0, 0x00,0x11, 0x08, 0x01,0x68, 0x02,0x80, 0x03,1,1,0,2,0x11,0,3,0x11,0, 0xff,0xd9]);
  assert.deepEqual(parseJpeg(b), { format: "jpg", width: 640, height: 360 });
});

test("parses WebP VP8X dimensions", () => {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii");
  b.write("WEBP", 8, "ascii");
  b.write("VP8X", 12, "ascii");
  const w = 639, h = 359;
  b[24] = w & 255; b[25] = (w >> 8) & 255; b[26] = (w >> 16) & 255;
  b[27] = h & 255; b[28] = (h >> 8) & 255; b[29] = (h >> 16) & 255;
  assert.deepEqual(parseWebp(b), { format: "webp", width: 640, height: 360 });
});
