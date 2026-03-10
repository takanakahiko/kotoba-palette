export function rgb2hex(rgb: [number, number, number]): string {
  if (rgb[0] === -1) return "";
  return ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
}
