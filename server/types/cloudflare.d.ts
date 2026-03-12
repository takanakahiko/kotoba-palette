/// <reference types="@cloudflare/workers-types" />

declare module "h3" {
  interface H3EventContext {
    cloudflare: {
      env: {
        KV: KVNamespace;
        BRAVE_API_KEY: string;
        BRAVE_API_BASE_URL?: string;
      };
    };
  }
}
