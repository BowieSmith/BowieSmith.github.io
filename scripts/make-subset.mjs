// make-subset.mjs -- pick a small, balanced sample of MNIST digits for the
// browser and write it as one PNG sprite sheet plus a little JSON file.
//
//   node scripts/make-subset.mjs [train-count] [test-count]
//
// Reads the unpacked IDX files from data/mnist/ and writes
//   data/digits-sample.png   -- a grid of 28x28 digits, white ink on black
//   data/digits-sample.json  -- { count, train, cols, labels }
// The first TRAIN digits come from MNIST's training set and may be used to
// train in the browser; the rest come from MNIST's test set and are only ever
// used to check the network. The choice is deterministic (seeded), so the
// sample is the same every time this runs.
//
// No dependencies: Node's zlib does the deflate and the CRC.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const mnistDir = join(dataDir, "mnist");

const TRAIN = Number(process.argv[2] || 1000);
const TEST = Number(process.argv[3] || 500);
const COLS = 50;

function readIdxImages(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 2051) throw new Error(path + " is not an IDX image file");
  const count = buf.readUInt32BE(4), rows = buf.readUInt32BE(8), cols = buf.readUInt32BE(12);
  if (rows !== 28 || cols !== 28) throw new Error("expected 28x28 images");
  if (buf.length !== 16 + count * 784) throw new Error(path + " is truncated; delete it and run pnpm mnist");
  const images = [];
  for (let i = 0; i < count; i++) images.push(buf.subarray(16 + i * 784, 16 + (i + 1) * 784));
  return images;
}

function readIdxLabels(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 2049) throw new Error(path + " is not an IDX label file");
  const count = buf.readUInt32BE(4);
  if (buf.length !== 8 + count) throw new Error(path + " is truncated; delete it and run pnpm mnist");
  return Array.from(buf.subarray(8, 8 + count));
}

// A small deterministic PRNG (mulberry32), so the sample never changes.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick N indices with (nearly) equal counts of each digit, in a shuffled order.
function balancedPick(labels, n, random) {
  const byDigit = Array.from({ length: 10 }, () => []);
  labels.forEach((l, i) => byDigit[l].push(i));
  byDigit.forEach((list) => shuffle(list, random));
  const picked = [];
  for (let k = 0; picked.length < n; k++) {
    const d = k % 10;
    if (byDigit[d].length) picked.push(byDigit[d].pop());
  }
  return shuffle(picked, random);
}

function shuffle(a, random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A minimal 8-bit grayscale PNG encoder.
function png(width, height, gray) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 0;  // color type: grayscale
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const trainImages = readIdxImages(join(mnistDir, "train-images-idx3-ubyte"));
const trainLabels = readIdxLabels(join(mnistDir, "train-labels-idx1-ubyte"));
const testImages = readIdxImages(join(mnistDir, "t10k-images-idx3-ubyte"));
const testLabels = readIdxLabels(join(mnistDir, "t10k-labels-idx1-ubyte"));

const random = rng(2026);
const trainPick = balancedPick(trainLabels, TRAIN, random);
const testPick = balancedPick(testLabels, TEST, random);

const chosen = [
  ...trainPick.map((i) => ({ img: trainImages[i], label: trainLabels[i] })),
  ...testPick.map((i) => ({ img: testImages[i], label: testLabels[i] })),
];

const count = chosen.length;
const rows = Math.ceil(count / COLS);
const width = COLS * 28, height = rows * 28;
const sheet = Buffer.alloc(width * height);
chosen.forEach(({ img }, k) => {
  const gx = (k % COLS) * 28, gy = Math.floor(k / COLS) * 28;
  for (let y = 0; y < 28; y++) img.copy(sheet, (gy + y) * width + gx, y * 28, (y + 1) * 28);
});

mkdirSync(dataDir, { recursive: true });
const pngBuf = png(width, height, sheet);
writeFileSync(join(dataDir, "digits-sample.png"), pngBuf);
writeFileSync(
  join(dataDir, "digits-sample.json"),
  JSON.stringify({ count, train: TRAIN, cols: COLS, labels: chosen.map((c) => c.label).join("") }) + "\n",
);

const counts = Array(10).fill(0);
chosen.forEach((c) => counts[c.label]++);
console.log(`wrote data/digits-sample.png (${width}x${height}, ${pngBuf.length} bytes) and data/digits-sample.json`);
console.log(`${TRAIN} training digits + ${TEST} held-back digits; per digit: ${counts.join(" ")}`);
