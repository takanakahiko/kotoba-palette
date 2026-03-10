/**
 * Postbuild script: Fix WASM import paths for Cloudflare Workers compatibility.
 *
 * Nitro generates WASM wrapper chunks in .output/server/chunks/_/ that import
 * WASM files via relative paths (e.g. "../../wasm/foo.wasm"). Wrangler's
 * find_additional_modules registers them as "wasm/foo.wasm" (relative to the
 * server root), so workerd cannot resolve the relative specifier at runtime.
 *
 * This script:
 * 1. Rewrites the import specifiers to bare "wasm/foo.wasm"
 * 2. Creates symlinks so wrangler's esbuild can still find the files on disk
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const serverDir = resolve(".output/server");
const chunksDir = join(serverDir, "chunks", "_");
const wasmDir = join(serverDir, "wasm");

if (!existsSync(wasmDir)) {
  console.log("No WASM directory found, skipping fix-wasm-paths.");
  process.exit(0);
}

const wasmFiles = readdirSync(wasmDir).filter((f) => f.endsWith(".wasm"));
if (wasmFiles.length === 0) {
  console.log("No WASM files found, skipping fix-wasm-paths.");
  process.exit(0);
}

// Create symlink directory inside chunks/_/ so esbuild can resolve bare "wasm/" imports
const symlinkDir = join(chunksDir, "wasm");
if (!existsSync(symlinkDir)) {
  mkdirSync(symlinkDir, { recursive: true });
}

for (const wasm of wasmFiles) {
  const target = join("../../../wasm", wasm);
  const link = join(symlinkDir, wasm);
  if (!existsSync(link)) {
    symlinkSync(target, link);
    console.log(`  symlink: ${link} -> ${target}`);
  }
}

// Rewrite WASM wrapper .mjs files in chunks/_/
const chunkFiles = readdirSync(chunksDir).filter((f) => f.endsWith(".mjs"));
let fixed = 0;

for (const file of chunkFiles) {
  const filePath = join(chunksDir, file);
  const content = readFileSync(filePath, "utf-8");

  // Match patterns like import("../../wasm/foo.wasm")
  if (content.includes('"../../wasm/')) {
    const updated = content.replaceAll('"../../wasm/', '"wasm/');
    writeFileSync(filePath, updated);
    console.log(`  fixed: ${file}`);
    fixed++;
  }
}

console.log(`fix-wasm-paths: ${fixed} file(s) fixed, ${wasmFiles.length} WASM symlink(s) created.`);
