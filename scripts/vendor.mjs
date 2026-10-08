// vendor.mjs -- copy the third-party code the site serves from node_modules
// into vendor/, which is committed. GitHub Pages serves the repository as-is
// and node_modules is not part of it, so anything a page loads at runtime has
// to be copied here, pinned to the version pnpm installed.
//
//   node scripts/vendor.mjs

import { copyFileSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = join(root, "vendor");
mkdirSync(vendor, { recursive: true });

const jsclDir = join(root, "node_modules", "jscl");
const jsclPkg = JSON.parse(readFileSync(join(jsclDir, "package.json"), "utf8"));
const jsclSrc = join(jsclDir, jsclPkg.main || "jscl.js");
copyFileSync(jsclSrc, join(vendor, "jscl.js"));
copyFileSync(join(jsclDir, "COPYING"), join(vendor, "jscl.LICENSE"));

writeFileSync(
  join(vendor, "README.md"),
  `# vendor/

Third-party code served with the site. Do not edit by hand; run \`pnpm vendor\`
after changing a version in package.json.

| file | from | version | license |
| --- | --- | --- | --- |
| jscl.js | [jscl](https://github.com/jscl-project/jscl) (npm \`jscl\`) | ${jsclPkg.version} | GPL-3.0-or-later (see jscl.LICENSE) |

jscl.js is JSCL's compiled output, copied unmodified from the npm package. Its
source code is at https://github.com/jscl-project/jscl/tree/v${jsclPkg.version}
`,
);

console.log(`vendor/jscl.js  <- jscl ${jsclPkg.version} (${statSync(jsclSrc).size} bytes)`);
