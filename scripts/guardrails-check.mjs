import fs from "node:fs";
import { execSync } from "node:child_process";

const forbidden = [
  ["deu", "tsche", " bank"].join(""),
  ["com", "merz", "bank"].join(""),
  "/users/",
  "c:\\users\\"
];

const files = execSync("rg --files --hidden -g '!node_modules' -g '!.git'", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const hits = new Map();
for (const file of files) {
  if (file === "scripts/guardrails-check.mjs") continue;
  const content = fs.readFileSync(file, "utf8").toLowerCase();
  for (const term of forbidden) {
    if (content.includes(term)) hits.set(term, true);
  }
}

if (hits.size) {
  console.error(`Forbidden content detected: ${[...hits.keys()].join(", ")}`);
  process.exit(1);
}

console.log("Guardrail scan passed.");
