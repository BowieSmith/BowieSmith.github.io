// fetch-mnist.mjs -- download the four MNIST files into data/mnist/ and unpack them.
//
//   node scripts/fetch-mnist.mjs
//
// The originals lived at yann.lecun.com/exdb/mnist, which now often refuses
// requests; this uses the mirror kept by the Common Visual Data Foundation.
// The files are about 11 MB compressed, 55 MB unpacked, and are not committed.

import { createWriteStream, existsSync, mkdirSync, openSync, readSync, closeSync, renameSync, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data", "mnist");
const MIRROR = "https://storage.googleapis.com/cvdf-datasets/mnist/";
const FILES = [
  "train-images-idx3-ubyte",
  "train-labels-idx1-ubyte",
  "t10k-images-idx3-ubyte",
  "t10k-labels-idx1-ubyte",
];

// An IDX file says how big it should be: a 4-byte magic number whose last
// byte is the number of dimensions, then each dimension as a big-endian
// uint32, then one byte per element.
function isComplete(path) {
  if (!existsSync(path)) return false;
  const size = statSync(path).size;
  if (size < 8) return false;
  const fd = openSync(path, "r");
  const header = Buffer.alloc(16);
  readSync(fd, header, 0, 16, 0);
  closeSync(fd);
  const dims = header[3];
  let expected = 4 + 4 * dims, elements = 1;
  for (let d = 0; d < dims; d++) elements *= header.readUInt32BE(4 + 4 * d);
  return size === expected + elements;
}

mkdirSync(dir, { recursive: true });

for (const name of FILES) {
  const target = join(dir, name);
  if (isComplete(target)) {
    console.log(`have ${name}`);
    continue;
  }
  const url = MIRROR + name + ".gz";
  process.stdout.write(`fetching ${name} ... `);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  // Write to a temporary name, so an interrupted download is never mistaken
  // for a finished one.
  const partial = target + ".part";
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(partial));
  if (!isComplete(partial)) {
    unlinkSync(partial);
    throw new Error(`${name} came out the wrong size; run this again`);
  }
  renameSync(partial, target);
  console.log(`${statSync(target).size} bytes`);
}
console.log(`MNIST is in ${dir}`);
