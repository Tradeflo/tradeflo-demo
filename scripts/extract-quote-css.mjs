import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "old-code/index.html"), "utf8");
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) throw new Error("no style block");
let css = m[1];
css = css.replace(/:root\{/g, ".qb-app{");
css = css.replace(/html\{font-size:16px\}\s*/g, "");
css = css.replace(
  /body\{background:var\(--bg\);color:var\(--text\);font-family:var\(--font\);min-height:100vh;line-height:1\.5\}/g,
  "",
);
const prefix = `.qb-app{font-size:16px;background:var(--bg);color:var(--text);font-family:var(--qb-font, "Instrument Sans"), system-ui, sans-serif;min-height:100vh;line-height:1.5}
.qb-app *,.qb-app *::before,.qb-app *::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
`;
const outDir = path.join(root, "src/components/quote-builder");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "quote-builder.css"), prefix + css);
console.log("Wrote quote-builder.css", prefix.length + css.length);
