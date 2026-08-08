"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  crc32,
  copyJpegMetadata,
  copyPngMetadata,
  copyWebpMetadata
} = require("../src/metadata");

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}
function png(...chunks) {
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ...chunks]);
}
function webpChunk(type, data = Buffer.alloc(0)) {
  const out = Buffer.alloc(8 + data.length + (data.length & 1));
  out.write(type, 0, 4, "ascii");
  out.writeUInt32LE(data.length, 4);
  data.copy(out, 8);
  return out;
}
function webp(...chunks) {
  const payload = Buffer.concat([Buffer.from("WEBP"), ...chunks]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}
function jpegSegment(marker, data) {
  const out = Buffer.alloc(4 + data.length);
  out[0] = 0xff; out[1] = marker;
  out.writeUInt16BE(data.length + 2, 2);
  data.copy(out, 4);
  return out;
}

test("PNG metadata copying preserves ICC and EXIF while replacing stale chunks", () => {
  const ihdr = pngChunk("IHDR", Buffer.alloc(13));
  const idat = pngChunk("IDAT", Buffer.from([1,2,3]));
  const source = png(ihdr, pngChunk("iCCP", Buffer.from("profile")), pngChunk("eXIf", Buffer.from("exif")), idat, pngChunk("IEND"));
  const output = png(ihdr, pngChunk("iCCP", Buffer.from("stale")), idat, pngChunk("IEND"));
  const result = copyPngMetadata(source, output, { copyMetadata: true, preserveColorProfile: true });
  assert.match(result.toString("latin1"), /profile/);
  assert.match(result.toString("latin1"), /exif/);
  assert.doesNotMatch(result.toString("latin1"), /stale/);
});

test("JPEG metadata copying preserves APP1 APP2 and APP13 segments", () => {
  const scan = Buffer.from([0xff,0xda,0x00,0x02,0xff,0xd9]);
  const source = Buffer.concat([
    Buffer.from([0xff,0xd8]),
    jpegSegment(0xe1, Buffer.from("EXIF")),
    jpegSegment(0xe2, Buffer.from("ICC")),
    jpegSegment(0xed, Buffer.from("IPTC")),
    scan
  ]);
  const output = Buffer.concat([Buffer.from([0xff,0xd8]), jpegSegment(0xe1, Buffer.from("OLD")), scan]);
  const result = copyJpegMetadata(source, output, { copyMetadata: true, preserveColorProfile: true });
  assert.match(result.toString("latin1"), /EXIF/);
  assert.match(result.toString("latin1"), /ICC/);
  assert.match(result.toString("latin1"), /IPTC/);
  assert.doesNotMatch(result.toString("latin1"), /OLD/);
});

test("WebP metadata is only added to valid extended VP8X containers", () => {
  const sourceVp8x = Buffer.alloc(10);
  sourceVp8x[0] = 0x2c;
  const source = webp(
    webpChunk("VP8X", sourceVp8x),
    webpChunk("ICCP", Buffer.from("icc")),
    webpChunk("VP8 ", Buffer.from([1,2,3,4])),
    webpChunk("EXIF", Buffer.from("exif")),
    webpChunk("XMP ", Buffer.from("xmp"))
  );
  const output = webp(webpChunk("VP8X", Buffer.alloc(10)), webpChunk("VP8 ", Buffer.from([9,8,7,6])));
  const result = copyWebpMetadata(source, output, { copyMetadata: true, preserveColorProfile: true });
  assert.match(result.toString("latin1"), /ICCP/);
  assert.match(result.toString("latin1"), /EXIF/);
  assert.match(result.toString("latin1"), /XMP /);
  const vp8xOffset = result.indexOf(Buffer.from("VP8X"));
  assert.equal(result[vp8xOffset + 8] & 0x2c, 0x2c);

  const simpleOutput = webp(webpChunk("VP8 ", Buffer.from([9,8,7,6])));
  assert.deepEqual(copyWebpMetadata(source, simpleOutput, { copyMetadata: true, preserveColorProfile: true }), simpleOutput);
});
