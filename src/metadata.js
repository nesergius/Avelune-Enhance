"use strict";

const fs = require("fs");

const JPEG_METADATA_MARKERS = new Set([0xe1, 0xe2, 0xed]); // EXIF/XMP, ICC, IPTC
const PNG_COPY_CHUNKS = new Set(["iCCP", "eXIf", "pHYs", "gAMA", "cHRM", "sRGB", "tEXt", "zTXt", "iTXt"]);
const WEBP_COPY_CHUNKS = new Set(["ICCP", "EXIF", "XMP "]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function jpegSegments(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const segments = [];
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    segments.push({ marker, start: offset, end: offset + 2 + length, data: buffer.subarray(offset, offset + 2 + length) });
    offset += 2 + length;
  }
  return { segments, imageStart: offset };
}

function copyJpegMetadata(source, output, { copyMetadata = true, preserveColorProfile = true } = {}) {
  const src = jpegSegments(source);
  const dst = jpegSegments(output);
  if (!src || !dst) return output;
  const wanted = src.segments.filter((segment) => {
    if (segment.marker === 0xe2) return preserveColorProfile;
    return copyMetadata && JPEG_METADATA_MARKERS.has(segment.marker);
  });
  if (!wanted.length) return output;
  const remove = new Set();
  if (copyMetadata) { remove.add(0xe1); remove.add(0xed); }
  if (preserveColorProfile) remove.add(0xe2);
  const keptHeader = dst.segments.filter((segment) => !remove.has(segment.marker)).map((segment) => segment.data);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...wanted.map((s) => s.data), ...keptHeader, output.subarray(dst.imageStart)]);
}

function parsePng(buffer) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (buffer.length < 12 || !buffer.subarray(0, 8).equals(signature)) return null;
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return null;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length), raw: buffer.subarray(offset, end) });
    offset = end;
    if (type === "IEND") break;
  }
  return chunks;
}

function makePngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.allocUnsafe(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

function copyPngMetadata(source, output, { copyMetadata = true, preserveColorProfile = true } = {}) {
  const src = parsePng(source);
  const dst = parsePng(output);
  if (!src || !dst) return output;
  const wanted = src.filter(({ type }) => {
    if (["iCCP", "sRGB", "gAMA", "cHRM"].includes(type)) return preserveColorProfile;
    return copyMetadata && PNG_COPY_CHUNKS.has(type);
  });
  if (!wanted.length) return output;
  const replaceTypes = new Set(wanted.map((chunk) => chunk.type));
  const result = [output.subarray(0, 8)];
  let inserted = false;
  for (const chunk of dst) {
    if (chunk.type === "IHDR") {
      result.push(chunk.raw);
      for (const meta of wanted) result.push(makePngChunk(meta.type, meta.data));
      inserted = true;
      continue;
    }
    if (replaceTypes.has(chunk.type)) continue;
    result.push(chunk.raw);
  }
  return inserted ? Buffer.concat(result) : output;
}

function parseWebp(buffer) {
  if (buffer.length < 12 || buffer.toString("ascii",0,4) !== "RIFF" || buffer.toString("ascii",8,12) !== "WEBP") return null;
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const padded = size + (size & 1);
    const end = offset + 8 + padded;
    if (end > buffer.length) return null;
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + size), raw: buffer.subarray(offset, end) });
    offset = end;
  }
  return chunks;
}

function makeWebpChunk(type, data) {
  const pad = data.length & 1;
  const out = Buffer.alloc(8 + data.length + pad);
  out.write(type, 0, 4, "ascii");
  out.writeUInt32LE(data.length, 4);
  data.copy(out, 8);
  return out;
}

function copyWebpMetadata(source, output, { copyMetadata = true, preserveColorProfile = true } = {}) {
  const src = parseWebp(source);
  const dst = parseWebp(output);
  if (!src || !dst) return output;

  // Extended WebP is required to advertise ICC/EXIF/XMP feature flags.
  // Never append metadata to a simple VP8/VP8L file without VP8X because
  // doing so creates a technically invalid container that some decoders reject.
  const destinationVp8x = dst.find(({ type }) => type === "VP8X");
  if (!destinationVp8x || destinationVp8x.data.length < 10) return output;

  const wanted = src.filter(({ type }) =>
    type === "ICCP"
      ? preserveColorProfile
      : (copyMetadata && WEBP_COPY_CHUNKS.has(type))
  );
  if (!wanted.length) return output;

  const byType = new Map(wanted.map((chunk) => [chunk.type, chunk]));
  const replaceTypes = new Set(byType.keys());
  const vp8xData = Buffer.from(destinationVp8x.data);
  if (byType.has("ICCP")) vp8xData[0] |= 0x20;
  if (byType.has("EXIF")) vp8xData[0] |= 0x08;
  if (byType.has("XMP ")) vp8xData[0] |= 0x04;

  const body = [];
  let imageChunkSeen = false;
  let trailingMetadataInserted = false;
  for (const chunk of dst) {
    if (replaceTypes.has(chunk.type)) continue;
    if (chunk.type === "VP8X") {
      body.push(makeWebpChunk("VP8X", vp8xData));
      if (byType.has("ICCP")) body.push(makeWebpChunk("ICCP", byType.get("ICCP").data));
      continue;
    }
    body.push(chunk.raw);
    if (["VP8 ", "VP8L", "ANMF"].includes(chunk.type)) imageChunkSeen = true;
    if (imageChunkSeen && !trailingMetadataInserted) {
      if (byType.has("EXIF")) body.push(makeWebpChunk("EXIF", byType.get("EXIF").data));
      if (byType.has("XMP ")) body.push(makeWebpChunk("XMP ", byType.get("XMP ").data));
      trailingMetadataInserted = true;
    }
  }
  if (!trailingMetadataInserted) {
    if (byType.has("EXIF")) body.push(makeWebpChunk("EXIF", byType.get("EXIF").data));
    if (byType.has("XMP ")) body.push(makeWebpChunk("XMP ", byType.get("XMP ").data));
  }
  const payload = Buffer.concat([Buffer.from("WEBP", "ascii"), ...body]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

function preserveImageMetadata(sourcePath, outputPath, options = {}) {
  if (!options.copyMetadata && !options.preserveColorProfile) return false;
  const source = fs.readFileSync(sourcePath);
  const output = fs.readFileSync(outputPath);
  const ext = outputPath.toLowerCase().split(".").pop();
  let updated = output;
  if (ext === "jpg" || ext === "jpeg") updated = copyJpegMetadata(source, output, options);
  else if (ext === "png") updated = copyPngMetadata(source, output, options);
  else if (ext === "webp") updated = copyWebpMetadata(source, output, options);
  if (updated !== output && !updated.equals(output)) {
    fs.writeFileSync(outputPath, updated);
    return true;
  }
  return false;
}

module.exports = {
  crc32,
  copyJpegMetadata,
  copyPngMetadata,
  copyWebpMetadata,
  preserveImageMetadata
};
