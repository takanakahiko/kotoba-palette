/// <reference path="../types/upng-js.d.ts" />
import { decode as decodeWebP } from "@jsquash/webp";
import jpegJs from "jpeg-js";
import UPNG from "upng-js";

// --- 型定義 ---

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

export type RGB = [number, number, number];
type LAB = [number, number, number];

export interface ColorEntry {
  color: RGB;
  ratio: number; // 画像内での占有率 (0-1)
  centerRatio: number; // このクラスタのうち中心領域(30%)由来ピクセルの割合 (0-1)
}

interface WeightedPixel {
  color: RGB;
  isCenter: boolean;
}

export interface ExtractColorsDebugResult {
  colors: ColorEntry[];
  bgColors: Array<RGB>;
  removedClusters: ColorEntry[];
  cropped: boolean;
}

export interface AggregateColorGroup {
  representative: RGB;
  selected: boolean;
  totalScore: number;
  colors: Array<{ color: RGB; score: number; ratio: number }>;
}

export interface AggregateColorsDebugResult {
  colors: Array<RGB>;
  groups: AggregateColorGroup[];
}

// --- 画像デコード ---

export async function decodeImage(buffer: ArrayBuffer, contentType: string): Promise<DecodedImage> {
  if (contentType.includes("webp")) {
    const img = await decodeWebP(buffer);
    return { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) };
  }
  if (contentType.includes("png")) {
    const img = UPNG.decode(buffer);
    const rgba = UPNG.toRGBA8(img)[0];
    if (!rgba) throw new Error("Failed to decode PNG");
    return { width: img.width, height: img.height, data: new Uint8Array(rgba) };
  }
  const img = jpegJs.decode(new Uint8Array(buffer), { useTArray: true });
  return { width: img.width, height: img.height, data: img.data };
}

// --- CIELAB色空間 ---

const LAB_E = 216 / 24389;
const LAB_K = 24389 / 27;

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

function rgbToLab(rgb: RGB): LAB {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  x = x > LAB_E ? x ** (1 / 3) : (LAB_K * x + 16) / 116;
  y = y > LAB_E ? y ** (1 / 3) : (LAB_K * y + 16) / 116;
  z = z > LAB_E ? z ** (1 / 3) : (LAB_K * z + 16) / 116;

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labToRgb(lab: LAB): RGB {
  const fy = (lab[0] + 16) / 116;
  const fx = lab[1] / 500 + fy;
  const fz = fy - lab[2] / 200;

  const xr = fx ** 3 > LAB_E ? fx ** 3 : (116 * fx - 16) / LAB_K;
  const yr = lab[0] > LAB_K * LAB_E ? fy ** 3 : lab[0] / LAB_K;
  const zr = fz ** 3 > LAB_E ? fz ** 3 : (116 * fz - 16) / LAB_K;

  const X = xr * 0.95047;
  const Y = yr;
  const Z = zr * 1.08883;

  const lr = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const lg = X * -0.969266 + Y * 1.8760108 + Z * 0.041556;
  const lb = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

function labDistSq(a: LAB, b: LAB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function findNearestIndex(lab: LAB, centroids: LAB[]): number {
  let minD = Infinity;
  let minIdx = 0;
  for (const [i, centroid] of centroids.entries()) {
    const d = labDistSq(lab, centroid);
    if (d < minD) {
      minD = d;
      minIdx = i;
    }
  }
  return minIdx;
}

// --- CIEDE2000色差 ---

function ciede2000(lab1: LAB, lab2: LAB): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;
  const Cab7 = Cab ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 6103515625)));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = (Math.atan2(b1, a1p) * 180) / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = (Math.atan2(b2, a2p) * 180) / Math.PI;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let hp: number;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp = (h1p + h2p + 360) / 2;
  } else {
    hp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((hp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hp - 63) * Math.PI) / 180);

  const Lp50sq = (Lp - 50) ** 2;
  const SL = 1 + (0.015 * Lp50sq) / Math.sqrt(20 + Lp50sq);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const dtheta = 30 * Math.exp(-(((hp - 275) / 25) ** 2));
  const Cp7 = Cp ** 7;
  const RC = 2 * Math.sqrt(Cp7 / (Cp7 + 6103515625));
  const RT = -Math.sin((2 * dtheta * Math.PI) / 180) * RC;

  const Lterm = dLp / SL;
  const Cterm = dCp / SC;
  const Hterm = dHp / SH;

  return Math.sqrt(Lterm * Lterm + Cterm * Cterm + Hterm * Hterm + RT * Cterm * Hterm);
}

function chroma(c: RGB): number {
  const lab = rgbToLab(c);
  return Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
}

function deltaE(a: RGB, b: RGB): number {
  return ciede2000(rgbToLab(a), rgbToLab(b));
}

// --- k-means (LAB空間) ---

function kMeans(pixels: WeightedPixel[], k: number, maxIterations: number = 20): ColorEntry[] {
  if (pixels.length <= k) {
    return pixels.map((p) => ({ color: p.color, ratio: 1 / pixels.length, centerRatio: p.isCenter ? 1 : 0 }));
  }

  const labs = pixels.map((p) => rgbToLab(p.color));

  // Farthest-point initialization
  const firstLab = labs[0];
  if (!firstLab) throw new Error("No pixels to cluster");
  const centroids: LAB[] = [[...firstLab]];
  for (let i = 1; i < k; i++) {
    let maxDist = -1;
    let farthest: LAB = firstLab;
    for (const lab of labs) {
      let minD = Infinity;
      for (const c of centroids) {
        const d = labDistSq(lab, c);
        if (d < minD) minD = d;
      }
      if (minD > maxDist) {
        maxDist = minD;
        farthest = lab;
      }
    }
    centroids.push([...farthest]);
  }

  // 反復
  for (let iter = 0; iter < maxIterations; iter++) {
    const sums: LAB[] = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array<number>(k).fill(0);

    for (const lab of labs) {
      const ci = findNearestIndex(lab, centroids);
      const sum = sums[ci];
      if (!sum) continue;
      sum[0] += lab[0];
      sum[1] += lab[1];
      sum[2] += lab[2];
      counts[ci] = (counts[ci] ?? 0) + 1;
    }

    let converged = true;
    for (const [i, centroid] of centroids.entries()) {
      const count = counts[i] ?? 0;
      if (count === 0) continue;
      const sum = sums[i];
      if (!sum) continue;
      const nL = sum[0] / count;
      const na = sum[1] / count;
      const nb = sum[2] / count;
      if (Math.abs(nL - centroid[0]) > 0.1 || Math.abs(na - centroid[1]) > 0.1 || Math.abs(nb - centroid[2]) > 0.1) {
        converged = false;
        centroids[i] = [nL, na, nb];
      }
    }
    if (converged) break;
  }

  // 最終割り当てでクラスタサイズ・中心率を計算
  const counts = new Array<number>(k).fill(0);
  const centerCounts = new Array<number>(k).fill(0);
  for (const [pi, lab] of labs.entries()) {
    const ci = findNearestIndex(lab, centroids);
    counts[ci] = (counts[ci] ?? 0) + 1;
    if (pixels[pi]?.isCenter) centerCounts[ci] = (centerCounts[ci] ?? 0) + 1;
  }

  const total = counts.reduce((a, b) => a + b, 0);
  return centroids
    .map((c, i) => ({
      color: labToRgb(c),
      ratio: total > 0 ? (counts[i] ?? 0) / total : 0,
      centerRatio: (counts[i] ?? 0) > 0 ? (centerCounts[i] ?? 0) / (counts[i] ?? 1) : 0,
    }))
    .sort((a, b) => b.ratio - a.ratio);
}

function kMeansRgb(colors: RGB[], k: number): ColorEntry[] {
  return kMeans(
    colors.map((color) => ({ color, isCenter: false })),
    k,
  );
}

// --- 端ピクセルサンプリング・支配色検出 ---

function sampleEdgePixels(image: DecodedImage): RGB[] {
  const { width, height, data } = image;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200));
  const pixels: RGB[] = [];

  for (let x = 0; x < width; x += step) {
    for (const y of [0, height - 1]) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] === 0) continue;
      pixels.push([data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0]);
    }
  }
  for (let y = 0; y < height; y += step) {
    for (const x of [0, width - 1]) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] === 0) continue;
      pixels.push([data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0]);
    }
  }

  return pixels;
}

function findDominantEdgeColor(image: DecodedImage, minRatio: number): RGB | null {
  const edgePixels = sampleEdgePixels(image);
  if (edgePixels.length < 10) return null;

  const clusters = kMeansRgb(edgePixels, 2);
  const dominant = clusters[0];
  if (!dominant || dominant.ratio < minRatio) return null;
  return dominant.color;
}

// --- 枠切り抜き ---

const BORDER_DELTA_E = 10;

function isLineBorder(data: Uint8Array | Buffer, borderLab: LAB, offsets: Iterable<number>): boolean {
  let match = 0;
  let total = 0;
  for (const offset of offsets) {
    total++;
    if (data[offset + 3] === 0) {
      match++;
      continue;
    }
    const rgb: RGB = [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
    if (ciede2000(rgbToLab(rgb), borderLab) < BORDER_DELTA_E) {
      match++;
    }
  }
  return total > 0 && match / total > 0.8;
}

function* rowOffsets(width: number, y: number, step: number): Iterable<number> {
  for (let x = 0; x < width; x += step) {
    yield (y * width + x) * 4;
  }
}

function* colOffsets(width: number, height: number, x: number, step: number): Iterable<number> {
  for (let y = 0; y < height; y += step) {
    yield (y * width + x) * 4;
  }
}

function stripBorder(image: DecodedImage): { image: DecodedImage; borderColor: RGB | null } {
  const { width, height, data } = image;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200));

  const borderColor = findDominantEdgeColor(image, 0.75);
  if (!borderColor) return { image, borderColor: null };

  const borderLab = rgbToLab(borderColor);

  const maxCropY = Math.floor(height * 0.25);
  const maxCropX = Math.floor(width * 0.25);

  let top = 0;
  for (let y = 0; y < maxCropY; y++) {
    if (!isLineBorder(data, borderLab, rowOffsets(width, y, step))) break;
    top = y + 1;
  }

  let bottom = height;
  for (let y = height - 1; y >= height - maxCropY; y--) {
    if (!isLineBorder(data, borderLab, rowOffsets(width, y, step))) break;
    bottom = y;
  }

  let left = 0;
  for (let x = 0; x < maxCropX; x++) {
    if (!isLineBorder(data, borderLab, colOffsets(width, height, x, step))) break;
    left = x + 1;
  }

  let right = width;
  for (let x = width - 1; x >= width - maxCropX; x--) {
    if (!isLineBorder(data, borderLab, colOffsets(width, height, x, step))) break;
    right = x;
  }

  const newW = right - left;
  const newH = bottom - top;
  if (newW < width * 0.5 || newH < height * 0.5) return { image, borderColor: null };
  if (top === 0 && bottom === height && left === 0 && right === width) return { image, borderColor: null };

  const newData = new Uint8Array(newW * newH * 4);
  for (let y = 0; y < newH; y++) {
    const srcOffset = ((top + y) * width + left) * 4;
    const dstOffset = y * newW * 4;
    newData.set((data as Uint8Array).slice(srcOffset, srcOffset + newW * 4), dstOffset);
  }

  return {
    image: { width: newW, height: newH, data: newData },
    borderColor,
  };
}

// --- ピクセルサンプリング ---

function samplePixels(image: DecodedImage, maxPixels: number = 10000): WeightedPixel[] {
  const { width, height, data } = image;
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / maxPixels));
  const pixels: WeightedPixel[] = [];

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let i = 0; i < totalPixels; i += step) {
    const offset = i * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const a = data[offset + 3] ?? 0;
    if (a === 0) continue;

    const x = i % width;
    const y = Math.floor(i / width);
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
    const isCenter = dist < 0.3;
    const centerWeight = isCenter ? 3 : dist < 0.6 ? 2 : 1;

    const cMax = Math.max(r, g, b);
    const cMin = Math.min(r, g, b);
    const sat = cMax === 0 ? 0 : (cMax - cMin) / cMax;
    const satWeight = sat > 0.5 ? 2 : sat > 0.15 ? 1.5 : 1;

    const weight = Math.round(centerWeight * satWeight);
    for (let w = 0; w < weight; w++) {
      pixels.push({ color: [r, g, b], isCenter });
    }
  }

  return pixels;
}

// --- 画像からの色抽出 ---

export function extractColorsFromImage(image: DecodedImage): {
  colors: ColorEntry[];
  bgColors: Array<RGB>;
  removedClusters: ColorEntry[];
  cropped: boolean;
} {
  const { image: cropped, borderColor } = stripBorder(image);
  const bgColor = findDominantEdgeColor(cropped, 0.6);

  // 背景色リスト（枠色 + 内側背景色、重複除去）
  const bgColors: Array<RGB> = [];
  if (borderColor) bgColors.push(borderColor);
  if (bgColor && !bgColors.some((bg) => deltaE(bg, bgColor) < 10)) {
    bgColors.push(bgColor);
  }

  const pixels = samplePixels(cropped);
  if (pixels.length === 0) {
    throw new Error("No valid pixels found in image");
  }

  // 背景クラスタ分を多めに確保して k-means
  const allClusters = kMeans(pixels, 6 + bgColors.length + 2);

  // 背景色から遠い順に6色を残す
  const ranked = allClusters.map((c) => ({
    entry: c,
    bgDist: bgColors.length > 0 ? Math.min(...bgColors.map((bg) => deltaE(c.color, bg))) : Infinity,
  }));
  ranked.sort((a, b) => b.bgDist - a.bgDist);

  const colors = ranked.slice(0, 6).map((s) => s.entry);
  const removedClusters = ranked.slice(6).map((s) => s.entry);

  return { colors, bgColors, removedClusters, cropped: cropped !== image };
}

// --- URL からの色抽出 ---

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const FETCH_HEADERS = {
  "User-Agent": "KotobaPaletteBot/2.0 (+https://github.com/takanakahiko/kotonoha-palette)",
};

export async function extractColors(imageUrl: string): Promise<ColorEntry[]> {
  const { colors } = await extractColorsDebug(imageUrl);
  return colors;
}

export async function extractColorsDebug(imageUrl: string): Promise<ExtractColorsDebugResult> {
  const res = await fetch(imageUrl, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }

  // Content-Lengthによるサイズチェック
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
    throw new Error("Image too large");
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();

  // 実際のサイズチェック（Content-Lengthが信頼できない場合に対応）
  if (buffer.byteLength > MAX_IMAGE_SIZE) {
    throw new Error("Image too large");
  }

  const image = await decodeImage(buffer, contentType);

  return extractColorsFromImage(image);
}

// --- 複数パレットの集約 ---

function computeScore(entry: ColorEntry): number {
  const centerBonus = entry.ratio * entry.centerRatio * 0.3;
  const chr = chroma(entry.color);
  const chromaMultiplier = chr > 30 ? 1.0 + (chr - 30) / 60 : chr > 10 ? 0.2 + (0.8 * (chr - 10)) / 20 : 0.2;
  return (entry.ratio + centerBonus) * chromaMultiplier;
}

function aggregateColorsInternal(palettes: ColorEntry[][], count: number = 6): AggregateColorsDebugResult {
  const scored = palettes.flat().map((entry) => ({
    color: entry.color,
    score: computeScore(entry),
    ratio: entry.ratio,
  }));

  // k=12 で k-means クラスタリングし、スコア上位グループから代表色を選出
  const K = Math.min(scored.length, 12);
  const clusterResult = kMeansRgb(
    scored.map((s) => s.color),
    K,
  );

  // 各 scored エントリを最寄りのクラスタに割り当て
  const scoredLabs = scored.map((s) => rgbToLab(s.color));
  const centroidLabs = clusterResult.map((c) => rgbToLab(c.color));

  const groups = clusterResult.map(() => ({
    colors: [] as Array<{ color: RGB; score: number; ratio: number }>,
    totalScore: 0,
  }));

  for (const [i, s] of scored.entries()) {
    const lab = scoredLabs[i];
    if (!lab) continue;
    const gi = findNearestIndex(lab, centroidLabs);
    const group = groups[gi];
    if (!group) continue;
    group.colors.push(s);
    group.totalScore += s.score;
  }

  const nonEmptyGroups = groups.filter((g) => g.colors.length > 0);
  for (const g of nonEmptyGroups) {
    g.colors.sort((a, b) => b.score - a.score);
  }
  nonEmptyGroups.sort((a, b) => b.totalScore - a.totalScore);

  const colors = nonEmptyGroups
    .slice(0, count)
    .map((g) => g.colors[0]?.color)
    .filter((c): c is RGB => c != null);

  const debugGroups: AggregateColorGroup[] = nonEmptyGroups.map((g, i) => ({
    representative: g.colors[0]?.color ?? ([0, 0, 0] as RGB),
    selected: i < count,
    totalScore: g.totalScore,
    colors: g.colors,
  }));

  return { colors, groups: debugGroups };
}

export function aggregateColors(palettes: ColorEntry[][], count: number = 6): Array<RGB> {
  return aggregateColorsInternal(palettes, count).colors;
}

export function aggregateColorsDebug(palettes: ColorEntry[][], count: number = 6): AggregateColorsDebugResult {
  return aggregateColorsInternal(palettes, count);
}
