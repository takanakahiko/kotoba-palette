const DAILY_LIMIT = 1000;

function todayKey(): string {
  const now = new Date();
  return `search-count:${now.toISOString().slice(0, 10)}`;
}

/**
 * レートリミットをチェックし、OK なら同時にカウントをインクリメントする。
 * kv が null（ローカル開発時）の場合はスキップする。
 *
 * 注意: KVのget→check→putは非アトミックなため、並行リクエストでリミットを
 * 超える可能性がある。Cloudflare KVはアトミック操作を提供しないため完全な
 * 解決は難しいが、概算のレート制限として機能する。
 */
export async function consumeRateLimit(kv: KVNamespace | null): Promise<void> {
  if (!kv) return;

  const key = todayKey();
  const current = parseInt((await kv.get(key)) || "0", 10);

  if (current >= DAILY_LIMIT) {
    throw createError({
      status: 429,
      message: "本日の検索上限に達しました。明日またお試しください。",
    });
  }

  // TTL 48時間（日をまたいでも翌日には消える）
  await kv.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
}
