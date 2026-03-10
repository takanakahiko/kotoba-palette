<template>
  <div class="debug-page">
    <h1>Debug: カラーパレット抽出パイプライン</h1>

    <div class="search-form">
      <input
        v-model="word"
        type="text"
        placeholder="キーワードを入力..."
        @keydown.enter="search"
      />
      <button @click="search" :disabled="loading">
        {{ loading ? '処理中...' : '検索' }}
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <template v-if="result">
      <!-- 1. 最終結果 -->
      <section class="section">
        <h2>最終パレット（集約結果）</h2>
        <div class="palette-row final-palette">
          <div
            v-for="(color, i) in result.aggregated"
            :key="i"
            class="color-swatch large"
            :style="swatchStyle(color)"
          >
            <span class="hex">{{ toHex(color) }}</span>
          </div>
        </div>
      </section>

      <!-- 2. 集約グループ -->
      <section v-if="result.aggregationGroups" class="section">
        <h2>集約グループ（LAB空間 k-means）</h2>
        <div
          v-for="(group, gi) in result.aggregationGroups"
          :key="gi"
          class="group-card"
          :class="{ 'group-selected': group.selected }"
        >
          <div class="group-header">
            <span class="group-index">#{{ gi + 1 }}</span>
            <div class="color-swatch small" :style="swatchStyle(group.representative)"></div>
            <span class="mono">{{ toHex(group.representative) }}</span>
            <span v-if="group.selected" class="status-badge success-badge">採用</span>
            <span v-else class="status-badge skip-badge">不採用</span>
            <span class="group-score">score: {{ group.totalScore.toFixed(2) }}</span>
            <span class="group-count">{{ group.colors.length }}色</span>
          </div>
          <div class="group-colors">
            <div v-for="(c, ci) in group.colors" :key="ci" class="group-color-item">
              <div class="color-swatch small" :style="swatchStyle(c.color)"></div>
              <span class="mono">{{ toHex(c.color) }}</span>
              <span class="group-color-detail">s:{{ c.score.toFixed(3) }} r:{{ c.ratio.toFixed(3) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. 画像ごとの詳細 -->
      <section class="section">
        <h2>画像ごとの抽出結果（{{ successCount }}/{{ result.perImage.length }}枚成功）</h2>
        <div
          v-for="(img, i) in result.perImage"
          :key="i"
          class="image-card"
          :class="{ 'image-error': img.status === 'error' }"
        >
          <div class="image-header">
            <span class="image-index">#{{ i + 1 }}</span>
            <span v-if="img.status === 'error'" class="status-badge error-badge">ERROR</span>
            <span v-else class="status-badge success-badge">OK</span>
            <span v-if="img.cropped" class="status-badge crop-badge">枠切り抜き</span>
          </div>

          <div class="image-body">
            <div class="image-preview">
              <img :src="img.url" :alt="`Image ${i + 1}`" loading="lazy" referrerpolicy="no-referrer" @error="onImgError" />
              <div class="image-url">{{ img.url }}</div>
            </div>

            <div v-if="img.status === 'error'" class="error-detail">
              {{ img.error }}
            </div>

            <div v-else class="colors-detail">
              <div class="bg-color-row">
                <span class="bg-label">背景色:</span>
                <template v-if="img.bgColors && img.bgColors.length > 0">
                  <div v-for="(bg, bi) in img.bgColors" :key="bi" class="bg-color-item">
                    <div class="color-swatch small" :style="swatchStyle(bg)"></div>
                    <span class="mono">{{ toHex(bg) }}</span>
                    <span class="mono bg-rgb">({{ bg.join(', ') }})</span>
                    <span v-if="img.cropped && bi === 0" class="bg-layer-label">枠色</span>
                    <span v-else class="bg-layer-label">背景</span>
                  </div>
                </template>
                <span v-else class="bg-none">検出なし</span>
              </div>
            </div>

            <div v-if="img.status === 'success'" class="colors-detail">
              <table>
                <thead>
                  <tr>
                    <th>色</th>
                    <th>HEX</th>
                    <th>RGB</th>
                    <th>占有率 (ratio)</th>
                    <th>中心率 (centerRatio)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(entry, j) in img.colors" :key="j">
                    <td>
                      <div class="color-swatch small" :style="swatchStyle(entry.color)"></div>
                    </td>
                    <td class="mono">{{ toHex(entry.color) }}</td>
                    <td class="mono">{{ entry.color.join(', ') }}</td>
                    <td>
                      <div class="bar-container">
                        <div class="bar ratio-bar" :style="{ width: (entry.ratio * 100) + '%' }"></div>
                        <span class="bar-label">{{ (entry.ratio * 100).toFixed(1) }}%</span>
                      </div>
                    </td>
                    <td>
                      <div class="bar-container">
                        <div class="bar center-bar" :style="{ width: (entry.centerRatio * 100) + '%' }"></div>
                        <span class="bar-label">{{ (entry.centerRatio * 100).toFixed(1) }}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="img.removedClusters && img.removedClusters.length > 0" class="removed-section">
                <div class="removed-label">除去されたクラスタ:</div>
                <div class="removed-list">
                  <div v-for="(entry, j) in img.removedClusters" :key="j" class="removed-item">
                    <div class="color-swatch small" :style="swatchStyle(entry.color)"></div>
                    <span class="mono">{{ toHex(entry.color) }}</span>
                    <span class="removed-ratio">{{ (entry.ratio * 100).toFixed(1) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface ColorEntry {
  color: [number, number, number];
  ratio: number;
  centerRatio: number;
}

interface PerImageResult {
  url: string;
  status: "success" | "error";
  error?: string;
  colors?: ColorEntry[];
  bgColors?: Array<[number, number, number]>;
  removedClusters?: ColorEntry[];
  cropped?: boolean;
}

interface AggregateColorGroup {
  representative: [number, number, number];
  selected: boolean;
  totalScore: number;
  colors: Array<{ color: [number, number, number]; score: number; ratio: number }>;
}

interface DebugResult {
  word: string;
  imageUrls: string[];
  perImage: PerImageResult[];
  aggregated: Array<[number, number, number]>;
  aggregationGroups?: AggregateColorGroup[];
}

const word = ref("");
const loading = ref(false);
const error = ref("");
const result = ref<DebugResult | null>(null);

const successCount = computed(() => result.value?.perImage.filter((r) => r.status === "success").length ?? 0);

function toHex(c: [number, number, number]): string {
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function swatchStyle(color: [number, number, number]): Record<string, string> {
  const textColor = (color[0] + color[1] + color[2]) / 3 > 128 ? "#000" : "#fff";
  return {
    backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
    color: textColor,
  };
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  const placeholder = document.createElement("div");
  placeholder.textContent = "画像を読み込めません";
  placeholder.style.cssText =
    "width:200px;height:100px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;color:#999;font-size:12px;border-radius:4px;border:1px dashed #ccc;";
  img.replaceWith(placeholder);
}

async function search() {
  if (!word.value.trim() || loading.value) return;
  loading.value = true;
  error.value = "";
  result.value = null;

  try {
    result.value = await $fetch<DebugResult>("/api/debug", {
      query: { word: word.value },
    });
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; message?: string };
    error.value = err?.data?.message || err?.message || String(e);
  } finally {
    loading.value = false;
  }
}

// URLクエリパラメータから初期値を取得して自動検索
const route = useRoute();
if (route.query.word) {
  word.value = decodeURIComponent(route.query.word as string);
  search();
}
</script>

<style lang="scss" scoped>
.debug-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 20px;
  color: #333;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 12px;
  color: #555;
}

.search-form {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;

  input {
    flex: 1;
    padding: 10px 14px;
    font-size: 16px;
    border: 2px solid #ccc;
    border-radius: 6px;
    outline: none;
    &:focus { border-color: #3b8070; }
  }

  button {
    padding: 10px 24px;
    font-size: 16px;
    background: #3b8070;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    &:hover { background: #2d6357; }
    &:disabled { background: #aaa; cursor: not-allowed; }
  }
}

.error {
  background: #fee;
  color: #c00;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.section {
  margin-bottom: 32px;
}

.palette-row {
  display: flex;
  gap: 4px;
  border-radius: 8px;
  overflow: hidden;
}

.final-palette .color-swatch {
  flex: 1;
}

.color-swatch {
  display: flex;
  align-items: center;
  justify-content: center;

  &.large {
    height: 80px;
    font-size: 14px;
    font-weight: bold;
  }

  &.small {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
}

.hex {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.image-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;

  &.image-error {
    border-color: #f88;
  }
}

.image-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f8f8;
  border-bottom: 1px solid #eee;
}

.image-index {
  font-weight: bold;
  color: #666;
}

.status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;

  &.success-badge { background: #dfd; color: #060; }
  &.error-badge { background: #fdd; color: #c00; }
  &.crop-badge { background: #def; color: #048; }
}

.image-body {
  padding: 12px;
}

.image-preview {
  margin-bottom: 12px;

  img {
    max-width: 200px;
    max-height: 150px;
    border-radius: 4px;
    border: 1px solid #eee;
    object-fit: contain;
  }
}

.image-url {
  font-size: 11px;
  color: #999;
  word-break: break-all;
  margin-top: 4px;
}

.error-detail {
  color: #c00;
  font-size: 13px;
  padding: 8px;
  background: #fff5f5;
  border-radius: 4px;
}

.bg-color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.bg-color-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bg-layer-label {
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 8px;
}

.bg-label {
  font-size: 13px;
  font-weight: bold;
  color: #666;
}

.bg-rgb {
  color: #999;
}

.bg-none {
  font-size: 13px;
  color: #999;
  font-style: italic;
}

.colors-detail {
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 2px solid #ddd;
    color: #666;
    font-size: 12px;
    white-space: nowrap;
  }

  td {
    padding: 6px 8px;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
  }
}

.mono {
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.bar-container {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 150px;
}

.bar {
  height: 16px;
  border-radius: 3px;
  min-width: 2px;

  &.ratio-bar { background: #6c9; }
  &.center-bar { background: #69c; }
}

.bar-label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.removed-section {
  margin-top: 10px;
  padding: 8px;
  background: #faf5f5;
  border-radius: 4px;
  border: 1px dashed #dcc;
}

.removed-label {
  font-size: 12px;
  font-weight: bold;
  color: #966;
  margin-bottom: 6px;
}

.removed-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.removed-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.removed-ratio {
  font-size: 11px;
  color: #999;
}

.group-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
  opacity: 0.6;

  &.group-selected {
    border-color: #6c9;
    opacity: 1;
  }
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f8f8;
  border-bottom: 1px solid #eee;
}

.group-index {
  font-weight: bold;
  color: #666;
  min-width: 24px;
}

.group-score {
  font-size: 12px;
  color: #888;
}

.group-count {
  font-size: 12px;
  color: #aaa;
  margin-left: auto;
}

.skip-badge {
  background: #eee;
  color: #999;
}

.group-colors {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
}

.group-color-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.group-color-detail {
  font-size: 10px;
  color: #aaa;
}

</style>
