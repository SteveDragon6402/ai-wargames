import { readFileSync } from "node:fs";

const D = "apps/web/app/got-houses-v2/data";
const src = readFileSync(`${D}/holds.ts`, "utf8");
const blocks = [...src.matchAll(/\n  \{\n([\s\S]*?)\n  \},/g)].map((m) => m[1]);
const f = (b, n) => {
  const m = b.match(new RegExp(`^\\s*${n}: (.*?),?$`, "m"));
  return m ? m[1] : null;
};
const holds = blocks.map((b) => ({
  id: JSON.parse(f(b, "id")),
  name: JSON.parse(f(b, "name")),
  region: JSON.parse(f(b, "region")),
  x: Number(f(b, "x")),
  y: Number(f(b, "y")),
  links: JSON.parse(f(b, "links")),
}));

console.log("holds:", holds.length);
const ids = new Set(holds.map((h) => h.id));
let problems = 0;
for (const h of holds) {
  for (const l of h.links) {
    if (!ids.has(l)) { console.log("DANGLING", h.id, "->", l); problems++; }
    else if (!holds.find((x) => x.id === l).links.includes(h.id)) {
      console.log("ASYMMETRIC", h.id, "->", l); problems++;
    }
  }
}

const adj = new Map(holds.map((h) => [h.id, h.links]));
const seen = new Set();
const stack = [holds[0].id];
while (stack.length) {
  const c = stack.pop();
  if (seen.has(c)) continue;
  seen.add(c);
  for (const n of adj.get(c)) if (!seen.has(n)) stack.push(n);
}
console.log("connected:", seen.size, "/", holds.length);
console.log(
  "degree<2:",
  holds.filter((h) => h.links.length < 2).map((h) => `${h.id} ${h.name}`).join(", ") || "none",
);

let min = Infinity, pair = "";
for (let i = 0; i < holds.length; i++)
  for (let j = i + 1; j < holds.length; j++) {
    const d = Math.hypot(holds[i].x - holds[j].x, holds[i].y - holds[j].y);
    if (d < min) { min = d; pair = `${holds[i].name} / ${holds[j].name}`; }
  }
console.log("closest pair:", pair, min.toFixed(1));
const byRegion = {};
holds.forEach((h) => (byRegion[h.region] = (byRegion[h.region] || 0) + 1));
console.log("per region:", byRegion);

const p = readFileSync(`${D}/pathways.ts`, "utf8");
const paths = [...p.matchAll(/\{\s*\n\s*a: "(\d+)",\s*\n\s*b: "(\d+)",/g)].map((m) => [m[1], m[2]]);
const pk = new Set(paths.map(([a, b]) => [a, b].sort().join("|")));
const lk = new Set();
holds.forEach((h) => h.links.forEach((l) => lk.add([h.id, l].sort().join("|"))));
console.log("pathways:", paths.length, "unique:", pk.size, "| links:", lk.size);
for (const k of lk) if (!pk.has(k)) { console.log("MISSING PATHWAY", k); problems++; }
for (const k of pk) if (!lk.has(k)) { console.log("ORPHAN PATHWAY", k); problems++; }
console.log("sea pathways:", [...p.matchAll(/sea: true/g)].length);
console.log(problems === 0 && seen.size === holds.length ? "\nMAP OK" : `\n${problems} PROBLEMS`);
