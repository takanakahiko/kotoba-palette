import { getEnv } from "./env";

export interface StoredResult {
  word: string;
  colors: string;
}

/** defineEventHandler のコールバックが受け取る event の型 */
type NitroEvent = Parameters<Parameters<typeof defineEventHandler>[0]>[0];

/**
 * KVから結果を取得する共通処理。
 * クエリパラメータ `id` のバリデーション・KV取得・エラーハンドリングを一括で行う。
 */
export async function getStoredResult(event: NitroEvent): Promise<StoredResult> {
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

  return JSON.parse(data) as StoredResult;
}
