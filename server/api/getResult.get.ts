import { getEnv } from "../utils/env";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id;

  if (!id || typeof id !== "string") {
    throw createError({ status: 400, message: "id parameter is required" });
  }

  const env = getEnv(event);
  if (!env.KV) {
    throw createError({ status: 500, message: "KV not available" });
  }

  const data = await env.KV.get(`result:${id}`);
  if (!data) {
    throw createError({ status: 404, message: "Result not found" });
  }

  const parsed = JSON.parse(data) as { word: string; colors: string };
  const colors = parsed.colors.split(",").map((hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  });

  return { word: parsed.word, colors };
});
