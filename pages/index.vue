<template>
  <div class="container">
    <ForkMeOnGithub />
    <div>
      <h1 class="title">ことばパレット</h1>
      <input type="text" placeholder="word" v-model="word" />
      <ColorsViewer :value="colors" />
      <div class="links">
        <a href="https://twitter.com/intent/tweet?original_referer=http%3A%2F%2Flocalhost%3A3000%2F&ref_src=twsrc%5Etfw&text=ことばパレット%20%23kotoba_palette&tw_p=tweetbutton&url=https%3A%2F%2Fkotoba-palette.herokuapp.com%2F" target="_blank" class="button--green">
          Share
        </a>
        <a href="https://twitter.com/takanakahiko" target="_blank" class="button--grey" >
          つくったひと
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import debounce from 'lodash/debounce'

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
  methods: {
    getColors: async function(){
      if(this.word.length == 0) return;
      this.$nuxt.$loading.start()
      try {
        const ret = await fetch('/api?word=' + this.word)
        const retJson = await ret.json()
        if(retJson.error) throw Error(retJson.error)
        this.colors = Object.keys(retJson).map(key => retJson[key].rgb)
      } catch (error) {
        this.$toast.error('エラーになりました : ' + error)
      }
      this.$nuxt.$loading.finish()
    }
  }
}
</script>

<style>
input {
  border: 0;
  border-bottom: 2px solid #5B5B5B;
  width: 100%;
  font-size: 30px;
  line-height: 35px;
  height: 70px;
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
