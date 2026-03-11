/**
 * E2E smoke test script
 *
 * Nuxt 開発サーバーを起動し、Playwright (playwright-core) で
 * 基本的な UI 要素の表示・操作をチェックしてからサーバーを停止する。
 *
 * Usage:
 *   node scripts/e2e-smoke.mjs
 *
 * 環境変数:
 *   CHROME_PATH  — Chromium 実行ファイルのパス (自動検出も行う)
 *   BASE_URL     — テスト対象 URL (デフォルト: http://127.0.0.1:3000)
 *   PORT         — 開発サーバーのポート (デフォルト: 3000)
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || "3000";
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

// ---------------------------------------------------------------------------
// Chromium 自動検出
// ---------------------------------------------------------------------------
function findChromium() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  // playwright が管理するブラウザを探す
  const cacheDir = join(process.env.HOME || "/root", ".cache", "ms-playwright");
  if (existsSync(cacheDir)) {
    const dirs = readdirSync(cacheDir)
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const candidate = join(cacheDir, dir, "chrome-linux", "chrome");
      if (existsSync(candidate)) return candidate;
    }
  }

  // システムの chromium / chrome
  for (const cmd of ["chromium-browser", "chromium", "google-chrome"]) {
    try {
      return execSync(`which ${cmd}`, { encoding: "utf-8" }).trim();
    } catch {
      // not found
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Dev server の起動・待機
// ---------------------------------------------------------------------------
function startDevServer() {
  const child = spawn("npx", ["nuxt", "dev", "--port", PORT], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none", NUXT_TELEMETRY_DISABLED: "1" },
  });

  // ログを収集 (デバッグ用)
  let log = "";
  child.stdout.on("data", (d) => {
    log += d.toString();
  });
  child.stderr.on("data", (d) => {
    log += d.toString();
  });

  child.getLog = () => log;
  return child;
}

async function waitForServer(url, serverProcess, { timeout = 300_000, interval = 3_000 } = {}) {
  const deadline = Date.now() + timeout;
  let lastStatus = "";
  while (Date.now() < deadline) {
    // サーバープロセスが異常終了していないかチェック
    if (serverProcess.exitCode !== null) {
      const log = serverProcess.getLog();
      throw new Error(`Dev server exited with code ${serverProcess.exitCode}\n${log.slice(-500)}`);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
      lastStatus = `HTTP ${res.status}`;
    } catch {
      lastStatus = "connecting...";
    }
    const elapsed = Math.round((Date.now() - (deadline - timeout)) / 1000);
    process.stdout.write(`\r  waiting... ${elapsed}s (${lastStatus})  `);
    await sleep(interval);
  }
  const log = serverProcess.getLog();
  throw new Error(`Dev server did not become ready within ${timeout / 1000}s\nLast log:\n${log.slice(-1000)}`);
}

// ---------------------------------------------------------------------------
// テストランナー
// ---------------------------------------------------------------------------
async function runTests(chromePath) {
  const { chromium } = await import("playwright-core");

  const browser = await chromium.launch({
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failures.push({ name, error: e.message });
      failed++;
    }
  }

  // --- Tests ---------------------------------------------------------------

  await test("トップページが表示される (HTTP 200)", async () => {
    const res = await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30_000 });
    if (res.status() !== 200) throw new Error(`Status: ${res.status()}`);
  });

  await test("タイトルが「ことのはパレット」を含む", async () => {
    const title = await page.title();
    if (!title.includes("ことのはパレット")) throw new Error(`Title: ${title}`);
  });

  await test("ロゴ画像が表示されている", async () => {
    const logo = page.locator("img.logo");
    await logo.waitFor({ timeout: 5_000 });
    const alt = await logo.getAttribute("alt");
    if (alt !== "ことのはパレット") throw new Error(`Alt: ${alt}`);
  });

  await test("検索入力フォームが存在する", async () => {
    const input = page.locator('input[type="text"]');
    await input.waitFor({ timeout: 5_000 });
    const placeholder = await input.getAttribute("placeholder");
    if (!placeholder.includes("言葉を入力")) throw new Error(`Placeholder: ${placeholder}`);
  });

  await test("送信ボタンが初期状態で disabled", async () => {
    const btn = page.locator('button[type="submit"]');
    const disabled = await btn.isDisabled();
    if (!disabled) throw new Error("Button is not disabled");
  });

  await test("テキスト入力で送信ボタンが有効になる", async () => {
    // Vue ハイドレーション完了を待つ
    await page.waitForFunction(() => window.__NUXT__?.config, { timeout: 10_000 });
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]');
    await input.click();
    await input.pressSequentially("桜", { delay: 50 });
    const btn = page.locator('button[type="submit"]');
    await btn.waitFor({ timeout: 5_000 });
    // Vue のリアクティビティ反映を待つ
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]')?.disabled,
      { timeout: 5_000 },
    );
  });

  await test("シェアボタンが存在する", async () => {
    const share = page.locator('button:has-text("シェア")');
    await share.waitFor({ timeout: 5_000 });
  });

  await test("「つくったひと」リンクが正しい href を持つ", async () => {
    const link = page.locator('a:has-text("つくったひと")');
    const href = await link.getAttribute("href");
    if (!href.includes("twitter.com")) throw new Error(`Href: ${href}`);
  });

  await test("Fork me on GitHub バナーが表示される", async () => {
    const img = page.locator('img[alt="Fork me on GitHub"]');
    await img.waitFor({ timeout: 5_000 });
  });

  // -----------------------------------------------------------------------

  await browser.close();
  return { passed, failed, failures };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // 1. Chromium を探す
  const chromePath = findChromium();
  if (!chromePath) {
    console.error("Error: Chromium が見つかりません。");
    console.error("  npx playwright install chromium を実行するか、CHROME_PATH 環境変数を設定してください。");
    process.exit(1);
  }
  console.log(`Chromium: ${chromePath}`);

  // 2. 開発サーバーを起動
  console.log(`Starting dev server on port ${PORT} ...`);
  const server = startDevServer();

  let exitCode = 1;
  try {
    await waitForServer(BASE_URL, server);
    console.log("\rDev server is ready.                    \n");

    // 3. テスト実行
    console.log("Running E2E smoke tests ...");
    const { passed, failed, failures } = await runTests(chromePath);

    console.log(`\n--- 結果: ${passed} passed, ${failed} failed ---`);
    if (failures.length > 0) {
      console.log("\nFailures:");
      for (const f of failures) {
        console.log(`  - ${f.name}: ${f.error}`);
      }
    }

    exitCode = failed > 0 ? 1 : 0;
  } catch (e) {
    console.error(`\nFatal error: ${e.message}`);
    exitCode = 1;
  } finally {
    // 4. サーバー停止
    console.log("\nStopping dev server ...");
    server.kill("SIGTERM");
    // 子プロセスツリーも確実に停止
    try {
      execSync(`kill -- -${server.pid} 2>/dev/null || true`);
    } catch {
      // ignore
    }
  }

  process.exit(exitCode);
}

main();
