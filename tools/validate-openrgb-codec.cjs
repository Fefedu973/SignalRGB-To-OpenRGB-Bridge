const assert = require("assert");

function u16(value) {
  value = value >>> 0;
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value) {
  value = value >>> 0;
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ];
}

function readU32(bytes, offset) {
  return (
    (bytes[offset] || 0) |
    ((bytes[offset + 1] || 0) << 8) |
    ((bytes[offset + 2] || 0) << 16) |
    ((bytes[offset + 3] || 0) << 24)
  ) >>> 0;
}

function encodePacket(commandId, payload, deviceId) {
  return [0x4f, 0x52, 0x47, 0x42]
    .concat(u32(deviceId || 0))
    .concat(u32(commandId))
    .concat(u32(payload.length))
    .concat(payload);
}

function encodeUpdateLedsPayload(colors) {
  const dataSize = 4 + 2 + 4 * colors.length;
  let payload = u32(dataSize).concat(u16(colors.length));

  for (const color of colors) {
    const value = color[0] | (color[1] << 8) | (color[2] << 16);
    payload = payload.concat(u32(value));
  }

  return payload;
}

function normalizeBytes(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((byte) => byte & 0xff);
  }

  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (typeof ArrayBuffer !== "undefined" && value.buffer instanceof ArrayBuffer) {
    const offset = value.byteOffset || 0;
    const length = value.byteLength !== undefined ? value.byteLength : value.length;
    return Array.from(new Uint8Array(value.buffer, offset, length));
  }

  return [];
}

const colors = [
  [0xff, 0x00, 0x00],
  [0x00, 0x80, 0x40]
];
const payload = encodeUpdateLedsPayload(colors);
const packet = encodePacket(1050, payload, 3);

assert.deepStrictEqual(packet.slice(0, 4), [0x4f, 0x52, 0x47, 0x42]);
assert.strictEqual(readU32(packet, 4), 3);
assert.strictEqual(readU32(packet, 8), 1050);
assert.strictEqual(readU32(packet, 12), payload.length);
assert.strictEqual(readU32(payload, 0), 14);
assert.strictEqual(payload[4] | (payload[5] << 8), 2);
assert.deepStrictEqual(payload.slice(6, 10), [0xff, 0x00, 0x00, 0x00]);
assert.deepStrictEqual(payload.slice(10, 14), [0x00, 0x80, 0x40, 0x00]);

const backingBuffer = new Uint8Array([0, 0, 0, 0, 0x4f, 0x52, 0x47, 0x42, 1, 2, 3, 4, 0, 0]).buffer;
const packetView = new Uint8Array(backingBuffer, 4, 8);
assert.deepStrictEqual(normalizeBytes(packetView), [0x4f, 0x52, 0x47, 0x42, 1, 2, 3, 4]);

console.log("OpenRGB codec validation passed.");
