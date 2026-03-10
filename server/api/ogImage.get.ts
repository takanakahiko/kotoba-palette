import { getEnv } from "../utils/env";

export default defineEventHandler(async (event) => {
  // Load logo SVG from server/assets
  const logoSvg = await useStorage("assets:server").getItem<string>("logo.svg");
  const logoDataUri = logoSvg
    ? `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`
    : "";

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
  const hexColors = parsed.colors.split(",");

  // Load font (TTF — satori does not support WOFF2)
  const cssResponse = await fetch("https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700", {
    headers: { "User-Agent": "Mozilla/4.0" },
  });
  const css = await cssResponse.text();
  const fontUrlMatch = css.match(/url\(([^)]+)\)/);
  if (!fontUrlMatch) {
    throw createError({ status: 500, message: "Failed to resolve font URL" });
  }
  const fontResponse = await fetch(fontUrlMatch[1]);
  const fontData = await fontResponse.arrayBuffer();

  const colorSwatches = hexColors.map((hex) => ({
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
      children: [
        {
          type: "div",
          props: {
            style: {
              width: "120px",
              height: "100px",
              backgroundColor: `#${hex}`,
              borderRadius: "8px",
            },
          },
        },
        {
          type: "span",
          props: {
            style: { fontSize: "16px", color: "#333", fontFamily: "monospace" },
            children: `#${hex}`,
          },
        },
      ],
    },
  }));

  // @cf-wasm/og handles satori + resvg WASM initialization for both Node.js and Cloudflare Workers
  const { ImageResponse } = await import("@cf-wasm/og");

  const imageResponse = new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "1200px",
          height: "630px",
          backgroundColor: "#fff",
          position: "relative",
        },
        children: [
          {
            type: "img",
            props: {
              src: logoDataUri,
              width: 300,
              height: 93,
              style: {
                position: "absolute",
                top: "24px",
                left: "32px",
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                fontSize: "100px",
                fontWeight: 700,
                color: "#333",
                fontFamily: "Noto Sans JP",
                marginBottom: "40px",
              },
              children: parsed.word,
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", gap: "16px" },
              children: colorSwatches,
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Noto Sans JP",
          data: fontData,
          weight: 700 as const,
          style: "normal" as const,
        },
      ],
    },
  );

  // ImageResponse is a standard Response — stream its body
  setResponseHeaders(event, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  });
  return imageResponse.body;
});
