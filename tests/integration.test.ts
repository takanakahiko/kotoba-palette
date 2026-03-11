import assert from "node:assert";
import { type ChildProcess, execSync, spawn } from "node:child_process";
import http from "node:http";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import UPNG from "upng-js";

const projectRoot = resolve(import.meta.dirname, "..");
const PORT = "3939";
const MOCK_PORT = 3940;
const BASE_URL = `http://localhost:${PORT}`;

type RGB = [number, number, number];

interface GetColorsResponse {
  colors: Array<RGB>;
  resultId: string;
}

interface GetResultResponse {
  word: string;
  colors: Array<RGB>;
}

// --- モックサーバー ---

function createTwoTonePng(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, size = 20): Buffer {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const useSecond = i >= (size * size) / 2;
    data[i * 4] = useSecond ? r2 : r1;
    data[i * 4 + 1] = useSecond ? g2 : g1;
    data[i * 4 + 2] = useSecond ? b2 : b1;
    data[i * 4 + 3] = 255;
  }
  return Buffer.from(UPNG.encode([data.buffer], size, size, 0));
}

const TEST_IMAGES: Record<string, Buffer> = {
  "red.png": createTwoTonePng(220, 50, 50, 180, 30, 30),
  "green.png": createTwoTonePng(50, 180, 50, 30, 140, 30),
  "blue.png": createTwoTonePng(50, 50, 220, 30, 30, 180),
  "yellow.png": createTwoTonePng(220, 200, 50, 200, 180, 30),
  "pink.png": createTwoTonePng(220, 100, 160, 200, 80, 140),
  "orange.png": createTwoTonePng(230, 140, 50, 210, 120, 30),
};

function startMockServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${MOCK_PORT}`);

      // Brave Image Search API のモック
      if (url.pathname === "/res/v1/images/search") {
        const results = Object.keys(TEST_IMAGES).map((name) => ({
          properties: { url: `http://localhost:${MOCK_PORT}/test-images/${name}` },
        }));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results }));
        return;
      }

      // テスト画像の配信
      const imageMatch = url.pathname.match(/^\/test-images\/(.+)$/);
      if (imageMatch && TEST_IMAGES[imageMatch[1]]) {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(TEST_IMAGES[imageMatch[1]]);
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    server.listen(MOCK_PORT, () => resolve(server));
  });
}

// --- ヘルパー ---

async function fetchApi<T>(path: string, query: Record<string, string> = {}): Promise<{ status: number; data: T }> {
  const params = new URLSearchParams(query);
  const url = `${BASE_URL}${path}${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  const data = await res.json();
  return { status: res.status, data: data as T };
}

async function fetchApiRaw(path: string, query: Record<string, string> = {}): Promise<Response> {
  const params = new URLSearchParams(query);
  const url = `${BASE_URL}${path}${params.toString() ? `?${params}` : ""}`;
  return fetch(url);
}

async function waitForServer(timeoutMs: number = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return;
    } catch {
      // まだ起動していない
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

function toHex(c: RGB): string {
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// --- テスト ---

describe("Integration Tests", () => {
  let serverProcess: ChildProcess | null = null;
  let mockServer: http.Server | null = null;

  before(async () => {
    // モックサーバー起動
    mockServer = await startMockServer();
    console.log(`Mock server started on port ${MOCK_PORT}`);

    const varArgs = [
      "--var",
      "BRAVE_API_KEY:dummy",
      "--var",
      `BRAVE_API_BASE_URL:http://localhost:${MOCK_PORT}`,
      "--var",
      "DISABLE_CACHE:1",
    ];

    // ビルド
    console.log("Building...");
    execSync("npm run build", { cwd: projectRoot, stdio: "pipe" });
    console.log("Build complete.");

    // wrangler dev 起動
    console.log(`Starting wrangler dev on port ${PORT}...`);
    serverProcess = spawn("npx", ["wrangler", "dev", "--port", PORT, ...varArgs], {
      cwd: projectRoot,
      stdio: "pipe",
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("ERROR")) console.error("[server]", msg.trim());
    });

    await waitForServer();
    console.log("Server is ready.");
  });

  after(() => {
    if (serverProcess) {
      console.log("Stopping server...");
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
    if (mockServer) {
      mockServer.close();
      mockServer = null;
    }
  });

  // ============================================================
  // /api/getColors エラーケース
  // ============================================================

  describe("GET /api/getColors - バリデーション", () => {
    it("wordパラメータなしで400を返す", async () => {
      const res = await fetchApiRaw("/api/getColors");
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok((body as { message: string }).message.includes("word"));
    });

    it("wordが空文字で400を返す", async () => {
      const res = await fetchApiRaw("/api/getColors", { word: "" });
      assert.strictEqual(res.status, 400);
    });

    it("wordが100文字超で400を返す", async () => {
      const longWord = "あ".repeat(101);
      const res = await fetchApiRaw("/api/getColors", { word: longWord });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok((body as { message: string }).message.includes("100"));
    });
  });

  // ============================================================
  // /api/getResult エラーケース
  // ============================================================

  describe("GET /api/getResult - バリデーション", () => {
    it("idパラメータなしで400を返す", async () => {
      const res = await fetchApiRaw("/api/getResult");
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok((body as { message: string }).message.includes("id"));
    });
  });

  // ============================================================
  // /api/ogImage エラーケース
  // ============================================================

  describe("GET /api/ogImage - バリデーション", () => {
    it("idパラメータなしで400を返す", async () => {
      const res = await fetchApiRaw("/api/ogImage");
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok((body as { message: string }).message.includes("id"));
    });
  });

  // ============================================================
  // /api/getColors 正常系
  // ============================================================

  describe("GET /api/getColors - 正常系", () => {
    it("有効なワードで検索すると6色のパレットとresultIdが返る", async () => {
      const { status, data } = await fetchApi<GetColorsResponse>("/api/getColors", { word: "桜" });

      assert.strictEqual(status, 200);
      assert.ok(data.colors, "colors が返されるべき");
      assert.strictEqual(data.colors.length, 6, "6色返されるべき");

      for (const color of data.colors) {
        assert.strictEqual(color.length, 3, "各色はRGBの3要素");
        for (const v of color) {
          assert.ok(v >= 0 && v <= 255, `RGB値は0-255の範囲: ${v}`);
        }
      }

      assert.ok(typeof data.resultId === "string", "resultIdが返されるべき");
      assert.ok(data.resultId.length > 0, "resultIdは空でないべき");
    });
  });

  // ============================================================
  // ページのレスポンス確認
  // ============================================================

  describe("ページの応答", () => {
    it("トップページ (/) が200を返す", async () => {
      const res = await fetchApiRaw("/");
      assert.strictEqual(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes("ことのはパレット"), "タイトルが含まれるべき");
    });

    it("トップページにOGPメタタグが含まれる", async () => {
      const res = await fetchApiRaw("/");
      const html = await res.text();
      assert.ok(html.includes("og:title"), "og:titleが含まれるべき");
      assert.ok(html.includes("og:description"), "og:descriptionが含まれるべき");
      assert.ok(html.includes("twitter:card"), "twitter:cardが含まれるべき");
    });

    it("存在しないページは404/200を返す", async () => {
      const res = await fetchApiRaw("/nonexistent-page-xyz");
      assert.ok(res.status === 200 || res.status === 404, `ステータス: ${res.status}`);
    });
  });

  // ============================================================
  // レスポンス形式の検証
  // ============================================================

  describe("レスポンス形式", () => {
    it("APIエラーレスポンスにmessageフィールドが含まれる", async () => {
      const res = await fetchApiRaw("/api/getColors");
      const body = (await res.json()) as { message?: string; statusCode?: number };
      assert.ok(body.message, "エラーレスポンスにmessageが含まれるべき");
      assert.ok(body.statusCode, "エラーレスポンスにstatusCodeが含まれるべき");
    });

    it("getColorsのレスポンスがJSON形式", async () => {
      const res = await fetchApiRaw("/api/getColors", { word: "森" });
      const contentType = res.headers.get("content-type");
      assert.ok(contentType?.includes("application/json"), `Content-Typeはapplication/jsonであるべき: ${contentType}`);
    });
  });

  // ============================================================
  // 境界値テスト
  // ============================================================

  describe("境界値", () => {
    it("wordが100文字ちょうどは受け付ける", async () => {
      const word = "あ".repeat(100);
      const res = await fetchApiRaw("/api/getColors", { word });
      assert.ok(res.status !== 400, `100文字は400にならないべき: status=${res.status}`);
    });

    it("特殊文字を含むwordを処理できる", async () => {
      const res = await fetchApiRaw("/api/getColors", { word: "C++" });
      assert.ok(res.status === 200 || res.status === 404, `特殊文字を処理できるべき: status=${res.status}`);
    });

    it("日本語以外のwordも処理できる", async () => {
      const res = await fetchApiRaw("/api/getColors", { word: "sunset" });
      assert.ok(res.status === 200 || res.status === 404, `英語でも処理できるべき: status=${res.status}`);
    });
  });

  // ============================================================
  // シナリオテスト
  // ============================================================

  describe("シナリオ: 検索 → 結果取得 → 共有フロー", () => {
    let searchResult: GetColorsResponse;

    it("1. 「桜」で検索してパレットを取得する", async () => {
      const { status, data } = await fetchApi<GetColorsResponse>("/api/getColors", { word: "桜" });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.colors.length, 6);
      assert.ok(data.resultId.length > 0);
      searchResult = data;
      console.log(`  検索結果: ${data.colors.map(toHex).join(", ")} (id: ${data.resultId})`);
    });

    it("2. resultIdで結果を取得し、検索結果と一致する", async () => {
      const { status, data } = await fetchApi<GetResultResponse>("/api/getResult", { id: searchResult.resultId });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.word, "桜");
      assert.strictEqual(data.colors.length, 6);

      for (let i = 0; i < 6; i++) {
        assert.deepStrictEqual(data.colors[i], searchResult.colors[i], `${i + 1}番目の色が一致するべき`);
      }
      console.log(`  getResult確認OK: word="${data.word}", colors=${data.colors.map(toHex).join(", ")}`);
    });

    it("3. resultIdでOGP画像を生成できる", async () => {
      const res = await fetchApiRaw("/api/ogImage", { id: searchResult.resultId });
      assert.strictEqual(res.status, 200);

      const contentType = res.headers.get("content-type");
      assert.ok(contentType?.includes("image/png"), `OGP画像はPNG形式であるべき: ${contentType}`);

      const body = await res.arrayBuffer();
      assert.ok(body.byteLength > 1000, `OGP画像は十分なサイズがあるべき: ${body.byteLength} bytes`);

      // PNGシグネチャの確認 (89 50 4E 47)
      const header = new Uint8Array(body.slice(0, 4));
      assert.strictEqual(header[0], 0x89, "PNGシグネチャ");
      assert.strictEqual(header[1], 0x50, "PNGシグネチャ");
      assert.strictEqual(header[2], 0x4e, "PNGシグネチャ");
      assert.strictEqual(header[3], 0x47, "PNGシグネチャ");
      console.log(`  OGP画像生成OK: ${body.byteLength} bytes`);
    });

    it("4. 共有URLでページを開くとOGPメタタグにresultIdが含まれる", async () => {
      const res = await fetchApiRaw(`/?id=${searchResult.resultId}`);
      assert.strictEqual(res.status, 200);

      const html = await res.text();
      assert.ok(html.includes(searchResult.resultId), "HTMLにresultIdが含まれるべき");
      assert.ok(html.includes("og:image"), "og:imageメタタグが含まれるべき");
      console.log("  共有URL表示OK");
    });
  });

  describe("シナリオ: 複数ワードの連続検索", () => {
    const words = ["海", "森", "紅葉"];
    const results: Map<string, GetColorsResponse> = new Map();

    it("異なるワードで連続検索し、それぞれ異なるresultIdが返る", async () => {
      for (const word of words) {
        const { status, data } = await fetchApi<GetColorsResponse>("/api/getColors", { word });
        assert.strictEqual(status, 200, `「${word}」の検索が成功するべき`);
        assert.strictEqual(data.colors.length, 6, `「${word}」は6色返されるべき`);
        results.set(word, data);
        console.log(`  ${word}: ${data.colors.map(toHex).join(", ")}`);
      }

      const ids = [...results.values()].map((r) => r.resultId);
      const uniqueIds = new Set(ids);
      assert.strictEqual(uniqueIds.size, words.length, "各ワードで異なるresultIdが生成されるべき");
    });
  });

  describe("シナリオ: エラーからの復帰", () => {
    it("不正なリクエストの後でも正常なリクエストが処理できる", async () => {
      const errorRes = await fetchApiRaw("/api/getColors");
      assert.strictEqual(errorRes.status, 400);

      const { status, data } = await fetchApi<GetColorsResponse>("/api/getColors", { word: "桜" });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.colors.length, 6);
    });

    it("存在しないAPIパスの後でも正常なリクエストが処理できる", async () => {
      const notFoundRes = await fetchApiRaw("/api/nonexistent");
      assert.ok(notFoundRes.status >= 400);

      const res = await fetchApiRaw("/api/getColors", { word: "空" });
      assert.ok(res.status === 200 || res.status === 404);
    });
  });

  describe("シナリオ: wordパラメータの前後空白正規化", () => {
    it("前後に空白があるワードでも検索できる", async () => {
      const { status, data } = await fetchApi<GetColorsResponse>("/api/getColors", { word: "  桜  " });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.colors.length, 6);
    });
  });

  describe("シナリオ: 存在しないresultIdでの結果取得", () => {
    it("存在しないresultIdでgetResultすると404を返す", async () => {
      const res = await fetchApiRaw("/api/getResult", { id: "000000000000" });
      assert.strictEqual(res.status, 404);
    });

    it("存在しないresultIdでogImageすると404を返す", async () => {
      const res = await fetchApiRaw("/api/ogImage", { id: "000000000000" });
      assert.strictEqual(res.status, 404);
    });
  });
});
