import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((p) => p && existsSync(p));
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
if (!existsSync("dist/index.html")) throw Error("Build before verifying");
const built = walk("dist"),
  failures = [];
const sensitive = [
  /\b(?:working_?key|(?:cca(?:venue)?_)?working_key|smtp_password|service_role_key)\s*[:=]\s*["'][a-z\d/+_.=-]{12,}["']/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sb_secret_|gh[pousr]_|re_)[A-Za-z0-9_-]{20,}/,
  /\beyJ[\w-]{12,}\.eyJ[\w-]{12,}\.[\w-]{16,}/,
  /https:\/\/[a-z\d]{20}\.supabase\.co/i,
];
for (const p of new Set([...tracked, ...built])) {
  if (/(^|\/)\.env(?:\.|$)/.test(p) && p !== ".env.example")
    failures.push(p + " environment file");
  if (/\.map$/.test(p)) failures.push(p + " source map");
  if (!/\.(?:md|json|js|sql|mjs|jsx|html|css|yml|example)$/.test(p)) continue;
  const s = readFileSync(p, "utf8");
  if (sensitive.some((re) => re.test(s)))
    failures.push(p + " sensitive pattern");
  if (
    p.startsWith("dist/") &&
    /ccavenue\.com|STAGING_SUPABASE_SERVICE_KEY|CCAVENUE_SANDBOX_WORKING_KEY|supabase\.co/.test(
      s,
    )
  )
    failures.push(p + " external provider");
  if (p.endsWith(".md"))
    for (const m of s.matchAll(/!?\[[^\]]*\]\(([^()\s]+)\)/g)) {
      if (
        !m[1].startsWith("#") &&
        !/^[a-z]+:/i.test(m[1]) &&
        !existsSync(resolve(dirname(p), m[1].split("#")[0]))
      )
        failures.push(p + " broken relative link");
    }
}
const entry = built.find((p) => /\/index-[^/]+\.js$/.test(p));
if (!entry || gzipSync(readFileSync(entry)).length > 120000)
  failures.push("Application entry exceeds 120 kB gzip");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Checked " +
      tracked.length +
      " tracked files and " +
      built.length +
      " built files; links, credentials, provider isolation and application-entry budget passed.",
  );
