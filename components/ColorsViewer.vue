<template>
  <div id="image-picker-palette" :class="{ active: isActive }">
    <div v-for="rgb in value" :key="rgb | rgb2code" :style="rgb | rgb2style">
      <span class="image-picker-palette-hex" >{{ rgb | rgb2code }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      default: () => []
    }
  },
  filters: {
    rgb2code: function(rgb){
      if(rgb[0] == -1) return ''
      return "#" + Math.floor((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
    },
    rgb2style: function(rgb){
      if(rgb[0] == -1) return `background: rgb(255, 255, 255);`
      return `background: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]});`
    },
  },
  computed: {
    isActive(){
      return this.value && this.value.length !== 0
    }
  }
}
</script>

<style scoped>
#image-picker-palette {
  margin: 5px;
  margin-top: 25px;
  height: 50px;
  border-radius: 5px;
  overflow: hidden;
  display: flex;
}

#image-picker-palette.active{
  border: 1px gray solid;
}

#image-picker-palette div {
  font-family: 'Quicksand', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  cursor: pointer;
  flex: 1;
  text-align: center;
  transition: width .3s ease;
  position: relative;
  line-height: 53px;
}
</style>
