/// <reference types="@cloudflare/workers-types" />

declare module "h3" {
  interface H3EventContext {
    cloudflare: {
      env: {
        KV: KVNamespace;
        BRAVE_API_KEY: string;
      };
    };
  }
}

declare module "upng-js" {
  interface Image {
    width: number;
    height: number;
    data: ArrayBuffer;
  }
  function decode(buf: ArrayBuffer): Image;
  function toRGBA8(img: Image): ArrayBuffer[];
  export { decode, toRGBA8, Image };
}
