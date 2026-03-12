import { getEnv } from "../utils/env";
import {
  type AggregateColorGroup,
  aggregateColorsDebug,
  type ColorEntry,
  extractColorsDebug,
  type RGB,
} from "../utils/extractColors";
import { imageSearch } from "../utils/imageSearch";

interface PerImageResult {
  url: string;
  status: "success" | "error";
  error?: string;
  colors?: ColorEntry[];
  bgColors?: Array<RGB>;
  removedClusters?: ColorEntry[];
  cropped?: boolean;
}

export default defineEventHandler(async (event) => {
  // 開発環境でのみ利用可能
  if (!import.meta.dev) {
    throw createError({ status: 404, message: "Not found" });
  }

  const query = getQuery(event);
  const word = query.word;

  if (!word || typeof word !== "string") {
    throw createError({ status: 400, message: "word parameter is required" });
  }

  const env = getEnv(event);

  const imageUrls = await imageSearch(word, env);

  if (imageUrls.length === 0) {
    throw createError({ status: 404, message: "No images found" });
  }

  const MAX_IMAGES = 5;
  const targetUrls = imageUrls.slice(0, MAX_IMAGES);

  const results = await Promise.allSettled(targetUrls.map((url) => extractColorsDebug(url)));

  const perImage: PerImageResult[] = targetUrls.map((url, i) => {
    const r = results[i];
    if (!r) return { url, status: "error" as const, error: "No result" };
    if (r.status === "fulfilled") {
      return {
        url,
        status: "success",
        colors: r.value.colors,
        bgColors: r.value.bgColors,
        removedClusters: r.value.removedClusters,
        cropped: r.value.cropped,
      };
    }
    return { url, status: "error", error: String(r.reason) };
  });

  const palettes = perImage
    .filter((r): r is PerImageResult & { colors: ColorEntry[] } => r.status === "success")
    .slice(0, MAX_IMAGES)
    .map((r) => r.colors);

  let aggregated: Array<RGB> = [];
  let aggregationGroups: AggregateColorGroup[] | undefined;

  if (palettes.length === 0) {
    aggregated = [];
  } else if (palettes.length === 1) {
    aggregated = palettes[0]?.map((e) => e.color) ?? [];
  } else {
    const debugResult = aggregateColorsDebug(palettes);
    aggregated = debugResult.colors;
    aggregationGroups = debugResult.groups;
  }

  return {
    word,
    imageUrls,
    perImage,
    aggregated,
    aggregationGroups,
  };
});
