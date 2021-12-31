<template>
  <div class="container">
    <ForkMeOnGithub />
    <div>
      <h1 class="title">ことばパレット</h1>
      <input type="text" placeholder="word" v-model="word" />
      <ColorsViewer :value="colors" />
      <div class="links">
        <button type="button" @click="share" class="button--green">
          シェア
        </button>
        <a href="https://twitter.com/takanakahiko" target="_blank" class="button--grey" >
          つくったひと
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import debounce from 'lodash/debounce'
import twitterShare from 'twitter-share'

import ColorsViewer from '~/components/ColorsViewer.vue'
import ForkMeOnGithub from '~/components/ForkMeOnGithub.vue'


export default {
  components: {
    ColorsViewer,ForkMeOnGithub
  },
  data: function(){
    return {
      word: '',
      colors: [],
      id: null
    }
  },
  watch: {
    word: function () {
      this.debouncedGetColors()
    }
  },
  created: function(){
    this.debouncedGetColors = debounce(this.getColors, 500)
  },
  asyncData: function({query}){
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    }
    return {
      id : query.id,
      word : (query.word) ? decodeURIComponent(query.word) : undefined,
      colors : (query.colors) ? query.colors.split(',').map(hexToRgb) : undefined
    }
  },
  head () {
    const meta = [
      { hid: 'og:site_name', property: 'og:site_name', content: 'あなたが好きなものは，どんな色をしてますか？' },
      { hid: 'og:type', property: 'og:type', content: 'website' },
      { hid: 'og:url', property: 'og:url', content: 'https://kotoba-palette.herokuapp.com' },
      { hid: 'og:title', property: 'og:title', content: 'ことばパレット' },
      { hid: 'og:description', property: 'og:description', content: 'あなたが好きなものは，どんな色をしてますか？' },
    ]
    if(this.id){
      meta.push({ hid: 'og:image', property: 'og:image', content: 'https://kotoba-palette.herokuapp.com/api/ogpImage?id=' + this.id })
      meta.push({ name: 'twitter:card', content: 'summary_large_image' })
    }
    return {
      title: 'ことばパレット',
      meta: meta
    }
  },
  methods: {
    getColors: async function(){
      if(this.word.length == 0) return;
      this.$nuxt.$loading.start()
      try {
        const ret = await fetch('/api/getColors?word=' + this.word)
        const retJson = await ret.json()
        if(retJson.error) throw Error(retJson.error)
        this.colors = Object.keys(retJson).map(key => retJson[key].rgb)
      } catch (error) {
        console.log(error)
        this.$toast.error('エラーになりました : ' + error)
      }
      this.$nuxt.$loading.finish()
    },
    share: async function(){
      const canvas = document.createElement("canvas")
      canvas.height = 630
      canvas.width = 1200
      const ctx = canvas.getContext("2d")
      ctx.fillStyle = `rgb(255,255,255)`
      ctx.fillRect(0,0,1200,630);
      ctx.fillStyle = `rgb(0,0,0)`
      ctx.font = "150px sans-serif"
      const wid = ctx.measureText(this.word)
      ctx.fillText(this.word, Math.max((800-wid.width)/2+200,200), 250, 800)
      const rgb2code = (rgb) => {
        if(rgb[0] == -1) return ''
        return "#" + Math.floor((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
      }
      ctx.font = "20px sans-serif"
      for(var i=0;i<6;i++){
        ctx.fillStyle = `rgb(${this.colors[i].join(',')})`;
        ctx.fillRect(175+i*150,350,100,100);
        ctx.fillStyle = `rgb(0,0,0)`
        ctx.fillText(rgb2code(this.colors[i]), 175+i*150,480,100)
      }
      const formData = new FormData();
      const getCanvasBlob = (canvas) => {
        return new Promise((resolve, reject) => canvas.toBlob(resolve, 'image/png'))
      }
      formData.append('image', await getCanvasBlob(canvas));
      const options = {
        method: 'POST',
        body: formData
      }
      try {
        const ret = await fetch('/api/saveOgpImage', options);
        const retJson = await ret.json()
        if(retJson.error) throw Error(retJson.error)
        const rgb2hex = (rgb) => {
          if(rgb[0] == -1) return ''
          return Math.floor((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
        }
        const tweetLink = twitterShare({
          text: `ことばパレットで「${this.word}」の色を調べてみました。 #kotoba_palette`,
          url: `https://kotoba-palette.herokuapp.com?id=${retJson.id}&word=${encodeURIComponent(this.word)}&colors=${this.colors.map(rgb2hex).join(',')}`,
        });
        if(!window.open(tweetLink)) window.location.href = tweetLink;
      } catch (error) {
        console.log(error)
        this.$toast.error('エラーになりました : ' + error)
      }
      this.$nuxt.$loading.finish()
    }
  }
}
</script>

<style lang="scss" scoped>
@import "~/assets/display.scss";

input {
  border: 0;
  border-bottom: 2px solid #5B5B5B;
  width: 70%;
  font-size: 30px;
  line-height: 35px;
  height: 70px;
  @include mobile {
    font-size: 15px;
    line-height: 20px;
    height: 35px;
  }
  text-align: center;
  padding: 10px;
  background: transparent;
  color: #5B5B5B;
}

input:focus {
 outline: 0;
}

input::placeholder {
 color: #AAAAAA;
}

.container {
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.title {
  font-family: 'Quicksand', 'Source Sans Pro', -apple-system, BlinkMacSystemFont,
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  display: block;
  font-weight: 300;
  font-size: 5rem;
  @include mobile {
    font-size: 2rem;
  }
  color: #35495e;
  letter-spacing: 1px;
}

.subtitle {
  font-weight: 300;
  font-size: 42px;
  color: #526488;
  word-spacing: 5px;
  padding-bottom: 15px;
}

.links {
  padding-top: 15px;
}
</style>
