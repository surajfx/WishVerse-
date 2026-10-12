// Joins src/lib.js + src/worker.js into ONE file (dist/worker.js) that can be pasted into the Cloudflare dashboard.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const lib = readFileSync(new URL("./src/lib.js", import.meta.url), "utf8").replace(/^export \{[\s\S]*?\};\s*$/m, "");
const w = readFileSync(new URL("./src/worker.js", import.meta.url), "utf8").replace(/^import \{[\s\S]*?\} from "\.\/lib\.js";\s*$/m, "");
mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/worker.js", import.meta.url), "// WishVerse API (Cloudflare Worker). Built from worker/src. Paste this whole file into the Worker editor.\n" + lib + "\n" + w);
console.log("built dist/worker.js");
