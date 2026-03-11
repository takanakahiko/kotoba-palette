import { rgb2hex } from "~/utils/color";
import { getEnv } from "../utils/env";
import { aggregateColors, type ColorEntry, extractColors } from "../utils/extractColors";
import { imageSearch } from "../utils/imageSearch";
import { consumeRateLimit } from "../utils/rateLimit";

const CACHE_TTL = 60 * 60 * 24; // 24時間

const MAX_WORD_LENGTH = 100;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const word = query.word;

  if (!word || typeof word !== "string") {
    throw createError({ status: 400, message: "word parameter is required" });
  }

  if (word.length > MAX_WORD_LENGTH) {
    throw createError({ status: 400, message: `word parameter must be ${MAX_WORD_LENGTH} characters or less` });
  }

  const env = getEnv(event);
  const useCache = !process.env.DISABLE_CACHE && env.KV;

  // キャッシュチェック（前後空白を除去して正規化）
  const cacheKey = `colors:${word.trim()}`;
  if (useCache) {
    const cached = await env.KV?.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // キャッシュが破損している場合は無視して再取得
        await env.KV?.delete(cacheKey);
      }
    }
  }

  // レートリミットチェック＋カウント（キャッシュミス時のみ）
  await consumeRateLimit(env.KV);

  const imageUrls = await imageSearch(word, env);

  if (imageUrls.length === 0) {
    throw createError({ status: 404, message: "No images found" });
  }

  const MAX_IMAGES = 5;

  // 先にスライスしてから処理（不要な画像ダウンロードを避ける）
  const results = await Promise.allSettled(imageUrls.slice(0, MAX_IMAGES).map((url) => extractColors(url)));

  const palettes = results
    .filter((r): r is PromiseFulfilledResult<ColorEntry[]> => r.status === "fulfilled")
    .map((r) => r.value);

  if (palettes.length === 0) {
    throw createError({ status: 500, message: "Failed to extract colors from any image" });
  }

  const colors = palettes.length === 1 ? palettes[0].map((e) => e.color) : aggregateColors(palettes);

  const resultId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const colorsHex = colors.map((c) => rgb2hex(c)).join(",");

  const result = { colors, resultId };

  if (env.KV) {
    await Promise.all([
      // キャッシュ（TTL付き）
      env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL }),
      // OGP用の永続データ
      env.KV.put(`result:${resultId}`, JSON.stringify({ word, colors: colorsHex })),
    ]);
  }

  return result;
});
