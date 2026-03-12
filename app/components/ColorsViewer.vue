<template>
  <div id="image-picker-palette" :class="{ active: isActive }">
    <div
      v-for="(rgb, index) in value"
      :key="index"
      :style="rgb2style(rgb)"
    >
      <span class="image-picker-palette-hex">{{ rgb2code(rgb) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { rgb2hex } from "~/utils/color";

const props = defineProps<{
  value: Array<[number, number, number]>;
}>();

const isActive = computed(() => props.value && props.value.length > 0);

function rgb2code(rgb: [number, number, number]): string {
  if (rgb[0] === -1) return "";
  return `#${rgb2hex(rgb)}`;
}

function rgb2style(rgb: [number, number, number]): string {
  if (rgb[0] === -1) return "background: rgb(255, 255, 255);";
  const textColor = (rgb[0] + rgb[1] + rgb[2]) / 3 > 128 ? "black" : "white";
  return `color:${textColor}; background: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]});`;
}
</script>

<style lang="scss" scoped>
@use "~/assets/display.scss" as *;

#image-picker-palette {
  margin: 5px;
  margin-top: 25px;
  height: 50px;
  line-height: 53px;
  @include mobile {
    height: 30px;
    line-height: 33px;
  }
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
  @include mobile {
    font-size: 10px;
    padding: 2px;
  }
}
</style>
