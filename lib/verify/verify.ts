/**
 * verify:hygiene — the phase-0 exit gate (architecture.md §15).
 *
 * Tooling script; excluded from its own scans. Uses Node APIs only so it
 * typechecks without @types/bun. Runs via `bun run lib/verify/verify.ts`.
 *
 * Checks:
 *  1. no console.* outside lib/logger
 *  2. no `any` (": any" / "<any>" / "as any")
 *  3. no `fetch(` outside lib/api (the one network boundary is lib/api/client)
 *  4. no import of anything under ../backend (no cross-app imports)
 *  5. hono / @hono/* absent from package.json deps
 *  6. every package.json dep is imported somewhere; every bare import is a
 *     declared dep (both directions)
 *
 * Allowlisted deps (documented in architecture.md §15): `react-dom` (peer of
 * next, imported by the framework itself) and any dep declared by a phase
 * before its first use lands in the next phase. The list must only shrink.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCAN_DIRS = ["app", "components", "lib", "stores", "hooks"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const DEP_ALLOWLIST = new Set(["react-dom", "zod", "zustand"]);

const violations: string[] = [];

function isCodeFile(name: string): boolean {
  return /\.(ts|tsx|mts|mjs|js|jsx)$/.test(name);
}

function isCssFile(name: string): boolean {
  return /\.css$/.test(name);
}

function walkFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) continue;
      for (const entry of readdirSync(current)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(current, entry);
        if (statSync(full).isDirectory()) {
          stack.push(full);
        } else if (isCodeFile(entry) || isCssFile(entry)) {
          files.push(full);
        }
      }
    }
  }
  return files;
}

function relative(file: string): string {
  return file.replace(ROOT, ".").replaceAll("\\", "/");
}

function scan(re: RegExp, label: string, skipPrefix?: string): void {
  for (const file of walkFiles()) {
    const rel = relative(file);
    if (rel.startsWith("./lib/verify/")) continue;
    if (skipPrefix !== undefined && rel.startsWith(skipPrefix)) continue;
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(re)) {
      const line =
        content.slice(0, match.index).split("\n").length;
      violations.push(`${label}: ${relative(file)}:${line}`);
    }
  }
}

const pkg = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const deps = Object.keys(pkg.dependencies ?? {});
const devDeps = Object.keys(pkg.devDependencies ?? {});
const allDeps = new Set([...deps, ...devDeps]);

function checkHono(): void {
  const isHono = (name: string) => name === "hono" || name.startsWith("@hono/");
  for (const name of [...deps, ...devDeps]) {
    if (isHono(name)) {
      violations.push(`banned dep: ${name} present in package.json`);
    }
  }
}

function packageNameOf(spec: string): string {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : spec;
  }
  return spec.split("/")[0];
}

function isRelativeOrAlias(spec: string): boolean {
  return (
    spec.startsWith(".") ||
    spec.startsWith("@/") ||
    spec.startsWith("/") ||
    spec.startsWith("node:")
  );
}

function checkDeps(): void {
  const imported = new Set<string>();
  const importRe = /(?:^|[^\w$])from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  const cssRe = /@import\s*["']([^"']+)["']/g;

  for (const file of walkFiles()) {
    if (relative(file).startsWith("./lib/verify/")) continue;
    const content = readFileSync(file, "utf8");
    const re = isCssFile(file.split(/[\\/]/).pop() ?? "") ? cssRe : importRe;
    for (const match of content.matchAll(re)) {
      const spec = match[1] ?? match[2];
      if (spec === undefined) continue;
      if (isRelativeOrAlias(spec)) continue;
      imported.add(packageNameOf(spec));
    }
  }

  for (const name of deps) {
    if (!imported.has(name) && !DEP_ALLOWLIST.has(name)) {
      violations.push(`unused dep: ${name} is in package.json but imported nowhere`);
    }
  }

  for (const name of [...imported].sort()) {
    if (!allDeps.has(name)) {
      violations.push(`undeclared import: ${name} imported but not in package.json`);
    }
  }
}

function main(): void {
  scan(/\bconsole\.(log|debug|info|warn|error|trace|table|dir|group)\(/g, "console.* outside lib/logger");
  scan(/: any\b|<any>|\bas any\b|as\s+unknown\s+as\s+any/g, "any");
  scan(/\bfetch\s*\(/g, "fetch( outside lib/api", "./lib/api/");
  scan(/["']\.\.\/[^"']*backend[^"']*["']/g, "import under ../backend");
  checkHono();
  checkDeps();

  if (violations.length > 0) {
    process.stdout.write(`verify:hygiene FAILED (${violations.length})\n${violations.join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write("verify:hygiene OK\n");
}

main();