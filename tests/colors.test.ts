import assert from "node:assert";
import { describe, it } from "node:test";
import { aggregateColors, type ColorEntry, extractColors, type RGB } from "../server/utils/extractColors";
import { imageSearch } from "../server/utils/imageSearch";

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";

function toHex(c: RGB): string {
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function colorDist(a: RGB, b: RGB): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function hasColorNear(colors: Array<RGB>, target: RGB, threshold: number = 80): boolean {
  return colors.some((c) => colorDist(c, target) < threshold);
}

/** 画像検索 → 色抽出 → 集約の一連パイプラインを実行 */
async function getPaletteForWord(word: string): Promise<Array<RGB>> {
  const imageUrls = await imageSearch(word, { BRAVE_API_KEY });
  if (imageUrls.length === 0) throw new Error(`No images found for "${word}"`);

  const MAX_IMAGES = 5;

  const results = await Promise.allSettled(imageUrls.slice(0, MAX_IMAGES).map((url) => extractColors(url)));

  const palettes = results
    .filter((r): r is PromiseFulfilledResult<ColorEntry[]> => r.status === "fulfilled")
    .map((r) => r.value);

  if (palettes.length === 0) throw new Error(`Failed to extract colors for "${word}"`);

  return palettes.length === 1 ? palettes[0].map((e) => e.color) : aggregateColors(palettes);
}

interface TestCase {
  word: string;
  expectedColors: Array<{
    name: string;
    rgb: RGB;
    threshold?: number;
  }>;
}

const testCases: TestCase[] = [
  {
    word: "桜",
    expectedColors: [{ name: "ピンク", rgb: [227, 168, 182] }],
  },
  {
    word: "初音ミク",
    expectedColors: [{ name: "ミントグリーン/水色", rgb: [130, 200, 190] }],
  },
  {
    word: "真中らぁら",
    expectedColors: [{ name: "紫/ラベンダー", rgb: [178, 166, 192] }],
  },
  {
    word: "海",
    expectedColors: [{ name: "青/ブルー", rgb: [50, 120, 200] }],
  },
  {
    word: "森",
    expectedColors: [{ name: "緑/グリーン", rgb: [60, 130, 60] }],
  },
  {
    word: "ひまわり",
    expectedColors: [{ name: "黄色", rgb: [220, 200, 50] }],
  },
  {
    word: "紅葉",
    expectedColors: [{ name: "赤/オレンジ", rgb: [200, 80, 40] }],
  },
  {
    word: "ラベンダー",
    expectedColors: [{ name: "紫", rgb: [160, 130, 210], threshold: 50 }],
  },
  {
    word: "抹茶",
    expectedColors: [{ name: "抹茶グリーン", rgb: [120, 150, 70] }],
  },
  {
    word: "トマト",
    expectedColors: [{ name: "赤", rgb: [200, 50, 40] }],
  },
  {
    word: "ピカチュウ",
    expectedColors: [{ name: "黄色", rgb: [230, 200, 50] }],
  },
  {
    word: "ドラえもん",
    expectedColors: [{ name: "青", rgb: [50, 130, 200] }],
  },
  {
    word: "孫悟空 ドラゴンボール",
    expectedColors: [{ name: "オレンジ", rgb: [230, 150, 50] }],
  },
  {
    word: "リゼロ レム",
    expectedColors: [{ name: "水色/青", rgb: [100, 160, 220] }],
  },
];

describe("カラーパレット抽出", { skip: !BRAVE_API_KEY && "BRAVE_API_KEY が設定されていません" }, () => {
  for (const tc of testCases) {
    it(`「${tc.word}」のパレットに期待する色が含まれる`, async () => {
      const colors = await getPaletteForWord(tc.word);
      console.log(`  ${tc.word}: ${colors.map(toHex).join(", ")}`);

      assert.strictEqual(colors.length, 6, `6色返されるべき`);

      for (const expected of tc.expectedColors) {
        const threshold = expected.threshold ?? 80;
        assert.ok(
          hasColorNear(colors, expected.rgb, threshold),
          `「${tc.word}」のパレットに${expected.name}(${toHex(expected.rgb)})が含まれるべき。実際: ${colors.map(toHex).join(", ")}`,
        );
      }
    });
  }
});
