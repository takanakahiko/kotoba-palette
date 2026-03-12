declare module "upng-js" {
  interface Image {
    width: number;
    height: number;
    data: ArrayBuffer;
  }
  function decode(buf: ArrayBuffer): Image;
  function toRGBA8(img: Image): ArrayBuffer[];
  function encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
  export { decode, toRGBA8, encode, Image };
}
