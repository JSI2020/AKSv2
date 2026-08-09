const fs = require("fs");
const zlib = require("zlib");

const path =
  "C:/Users/jawwa/Downloads/AKS Atelier Redesign - Standalone123.html";
const html = fs.readFileSync(path, "utf8");

const templateMatch = html.match(
  /<script type="__bundler\/template">\s*([\s\S]*?)<\/script>/,
);
if (!templateMatch) {
  console.error("no template");
  process.exit(1);
}
let template = templateMatch[1].trim();
if (template.startsWith('"')) template = JSON.parse(template);
fs.writeFileSync("tmp-prototype.html", template);
console.log("template chars", template.length);

// Extract CSS color tokens / structure clues
const colors = [...template.matchAll(/#[0-9A-Fa-f]{3,8}/g)].map((m) => m[0]);
const uniq = [...new Set(colors)].slice(0, 40);
console.log("colors", uniq.join(", "));

const fonts = [...template.matchAll(/font-family:\s*([^;}{]+)/gi)].map(
  (m) => m[1].trim(),
);
console.log("fonts", [...new Set(fonts)].slice(0, 20).join(" | "));

// Pull visible text chunks
const texts = [...template.matchAll(/>([^<]{2,80})</g)]
  .map((m) => m[1].trim())
  .filter((t) => t && !t.startsWith("{") && /[A-Za-z]/.test(t));
console.log("texts sample:");
for (const t of [...new Set(texts)].slice(0, 60)) console.log(" -", t);
