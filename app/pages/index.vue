<template>
  <div class="container">
    <ForkMeOnGithub />
    <div>
      <h1 class="title"><img src="/logo.svg" alt="ことのはパレット" class="logo" /></h1>
      <form @submit.prevent="getColors" class="search-form">
        <div class="input-wrapper">
          <input type="text" placeholder="言葉を入力" v-model="word" />
          <button v-if="word" type="button" class="clear-button" @click="clearInput">✕</button>
        </div>
        <button type="submit" class="search-button" :disabled="!word || loading">
          <span v-if="loading" class="spinner" />
          <span v-else>🎨</span>
        </button>
      </form>
      <ColorsViewer :value="colors" />
      <div class="links">
        <button type="button" @click="share" class="button--green" :disabled="colors.length === 0">
          シェア
        </button>
        <a href="https://twitter.com/takanakahiko" target="_blank" class="button--grey">
          つくったひと
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "~/composables/useToast";

const route = useRoute();
const toast = useToast();
const loading = ref(false);

const queryId = (route.query.id as string) || "";
const queryWord = route.query.word ? decodeURIComponent(route.query.word as string) : "";

// IDがある場合はKVからデータを復元
let initialWord = queryWord;
let initialColors: Array<[number, number, number]> = [];

if (queryId) {
  const requestFetch = useRequestFetch();
  const { data } = await useAsyncData(`result-${queryId}`, () =>
    requestFetch<{ word: string; colors: Array<[number, number, number]> }>("/api/getResult", {
      query: { id: queryId },
    }),
  );
  if (data.value) {
    initialWord = data.value.word;
    initialColors = data.value.colors;
  }
}

const word = ref(initialWord);
const colors = ref<Array<[number, number, number]>>(initialColors);
const resultId = ref(queryId);

// OGP
const siteUrl = "https://kotonoha-palette.takanakahiko.me";

const ogMeta: Array<{ property?: string; name?: string; content: string }> = [
  { property: "og:site_name", content: "あなたが好きなものは，どんな色をしてますか？" },
  { property: "og:type", content: "website" },
  { property: "og:url", content: siteUrl },
  { property: "og:title", content: "ことのはパレット" },
  { property: "og:description", content: "あなたが好きなものは，どんな色をしてますか？" },
  { name: "twitter:card", content: "summary_large_image" },
];

if (queryId) {
  ogMeta.push({ property: "og:image", content: `${siteUrl}/api/ogImage?id=${queryId}` });
}

useHead({
  title: "ことのはパレット",
  meta: ogMeta,
});

// URLクエリパラメータにwordのみがある場合は自動検索
if (queryWord && !queryId) {
  getColors();
}

async function getColors() {
  if (word.value.length === 0) return;
  loading.value = true;
  try {
    const ret = await $fetch<{ colors: Array<[number, number, number]>; resultId: string }>("/api/getColors", {
      query: { word: word.value },
    });
    colors.value = ret.colors;
    resultId.value = ret.resultId ?? "";
  } catch (error: unknown) {
    console.log(error);
    const e = error as { data?: { message?: string }; message?: string };
    const msg = e?.data?.message || e?.message || String(error);
    toast.error(msg);
  } finally {
    loading.value = false;
  }
}

function clearInput() {
  word.value = '';
  colors.value = [];
  resultId.value = '';
}

function share() {
  const shareUrl = `${siteUrl}?id=${resultId.value}`;
  const text = encodeURIComponent(`ことのはパレットで「${word.value}」の色を調べてみました。 #kotonoha_palette`);
  const tweetLink = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;

  if (!window.open(tweetLink)) {
    window.location.href = tweetLink;
  }
}
</script>

<style lang="scss" scoped>
@use "~/assets/display.scss" as *;

.input-wrapper {
  position: relative;
  width: 70%;
}

input {
  border: 1px solid #CCCCCC;
  border-radius: 4px;
  width: 100%;
  font-size: 30px;
  line-height: 35px;
  height: 70px;
  @include mobile {
    font-size: 15px;
    line-height: 20px;
    height: 35px;
  }
  text-align: center;
  padding: 10px 40px 10px 10px;
  @include mobile {
    padding: 10px 30px 10px 10px;
  }
  background: transparent;
  color: #5B5B5B;
  box-sizing: border-box;
}

.clear-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  -webkit-appearance: none;
  appearance: none;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
  color: #AAAAAA;
  padding: 4px 8px;
  line-height: 1;
  @include mobile {
    font-size: 14px;
    right: 4px;
    padding: 2px 4px;
  }

  &:hover {
    color: #5B5B5B;
  }
}

input:focus {
 outline: 0;
}

input::placeholder {
 color: #AAAAAA;
}

.container {
  margin: 0 auto;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.title {
  display: block;
  margin: 0 0 10px;
}

.logo {
  width: 550px;
  height: auto;
  @include mobile {
    width: 300px;
  }
}

.subtitle {
  font-weight: 300;
  font-size: 42px;
  color: #526488;
  word-spacing: 5px;
  padding-bottom: 15px;
}

.search-form {
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 10px;
}

.search-button {
  -webkit-appearance: none;
  appearance: none;
  background-color: transparent;
  border: 1px solid #CCCCCC;
  border-radius: 4px;
  cursor: pointer;
  font-size: 30px;
  padding: 0 15px;
  @include mobile {
    font-size: 15px;
    padding: 0 10px;
  }

  &:hover:not(:disabled) {
    background-color: #f0f0f0;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.links {
  padding-top: 15px;
}

.spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid #ccc;
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
