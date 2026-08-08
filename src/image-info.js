"use strict";

const fs = require("fs");

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parsePng(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    let markerOffset = offset + 1;
    while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= buffer.length) break;
    const marker = buffer[markerOffset];
    offset = markerOffset + 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { format: "jpg", height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function parseJpegFile(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    const head = Buffer.allocUnsafe(2);
    if (fs.readSync(fd, head, 0, 2, 0) !== 2 || head[0] !== 0xff || head[1] !== 0xd8) return null;
    let position = 2;
    const one = Buffer.allocUnsafe(1);
    const two = Buffer.allocUnsafe(2);
    const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    while (position < stat.size) {
      do {
        if (fs.readSync(fd, one, 0, 1, position) !== 1) return null;
        position += 1;
      } while (one[0] !== 0xff && position < stat.size);
      do {
        if (fs.readSync(fd, one, 0, 1, position) !== 1) return null;
        position += 1;
      } while (one[0] === 0xff && position < stat.size);
      const marker = one[0];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (fs.readSync(fd, two, 0, 2, position) !== 2) return null;
      const length = two.readUInt16BE(0);
      if (length < 2 || position + length > stat.size) return null;
      if (sof.has(marker)) {
        const dims = Buffer.allocUnsafe(5);
        if (fs.readSync(fd, dims, 0, 5, position + 2) !== 5) return null;
        return { format: "jpg", height: dims.readUInt16BE(1), width: dims.readUInt16BE(3) };
      }
      position += length;
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function parseWebp(buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = buffer.toString("ascii", 12, 16);
  if (type === "VP8X" && buffer.length >= 30) return { format: "webp", width: 1 + readUInt24LE(buffer, 24), height: 1 + readUInt24LE(buffer, 27) };
  if (type === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) return { format: "webp", width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (type === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { format: "webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

function getImageInfo(filePath) {
  const fd = fs.openSync(filePath, "r");
  let data;
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    data = buffer.subarray(0, bytesRead);
  } finally { fs.closeSync(fd); }
  const result = parsePng(data) || parseWebp(data) || parseJpeg(data) || parseJpegFile(filePath);
  if (!result || !result.width || !result.height) throw new Error("Файл не является корректным PNG, JPG или WebP изображением.");
  return result;
}

module.exports = { getImageInfo, parsePng, parseJpeg, parseJpegFile, parseWebp };
