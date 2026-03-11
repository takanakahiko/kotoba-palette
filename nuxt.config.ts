export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@nuxt/fonts"],
  devServer: {
    host: "0.0.0.0",
  },
  fonts: {
    families: [{ name: "Noto Sans JP", weights: [700], global: true }],
  },
  nitro: {
    preset: "cloudflare-module",
    experimental: {
      wasm: true,
    },
  },
  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1, maximum-scale=1",
      title: "ことのはパレット",
      meta: [{ name: "description", content: "あなたが好きなものは，どんな色をしてますか？" }],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },
});
