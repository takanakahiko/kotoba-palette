/// <reference types="@cloudflare/workers-types" />

interface AppEnv {
  KV: KVNamespace | null;
  BRAVE_API_KEY?: string;
  BRAVE_API_BASE_URL?: string;
}

/**
 * Cloudflare Workers 上では event.context.cloudflare.env から取得し、
 * ローカル開発時は process.env にフォールバックする。
 */
// biome-ignore lint/suspicious/noExplicitAny: Nitro event context type
export function getEnv(event: { context: any }): AppEnv {
  const cf = event.context.cloudflare?.env;

  return {
    KV: cf?.KV ?? null,
    BRAVE_API_KEY: cf?.BRAVE_API_KEY ?? process.env.BRAVE_API_KEY,
    BRAVE_API_BASE_URL: cf?.BRAVE_API_BASE_URL ?? process.env.BRAVE_API_BASE_URL,
  };
}
