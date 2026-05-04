<template>
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-media swipe">
        <div class="swipe-track" ref="trackEl">
          <img
            v-for="img in images"
            :key="img.id"
            :src="img.src"
            :alt="img.alt"
            class="hero-img"
            loading="lazy"
            referrerpolicy="no-referrer"
            draggable="false"
          />
        </div>
      </div>

      <div class="hero-text">
        <h1 class="title">{{ title }}</h1>
        <p class="desc">{{ desc }}</p>

        <div class="actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </section>

</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { HERO_IMAGES } from '../content/data/heroImages'

defineProps({
  title: String,
  desc: String,
})

const images = HERO_IMAGES

const trackEl = ref(null)
let timer = null
let index = 0

function scrollToIndex(i) {
  const el = trackEl.value
  if (!el) return

  const children = el.children
  if (!children?.length) return

  const target = children[i]
  if (!target) return

  // 平滑滑到下一張（不浮誇）
  el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
}

function next() {
  if (!images.length) return
  index = (index + 1) % images.length
  scrollToIndex(index)
}

onMounted(() => {
  if (images.length <= 1) return
  timer = setInterval(next, 4500) // 你可調整秒數
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>


<style scoped>
.hero{
  width: min(980px, 100%);margin: 0 auto;
}
.hero-inner{
  display:grid;
  gap: 14px;
  background: rgba(255,255,255,.86);
  border: 1px solid rgba(17,24,39,.10);
  border-radius: 18px;
  padding: clamp(16px, 2.2vw, 22px);
  box-shadow: 0 12px 32px rgba(17,24,39,.08);
}
.hero-media{
  border-radius: 16px;
  overflow:hidden;
  border: 1px solid rgba(17,24,39,.10);
  background: linear-gradient(135deg, rgba(109,92,255,.10), rgba(0,194,255,.10));
}
.media-placeholder{
  aspect-ratio: 16 / 9;
  display:flex;
  align-items:center;
  justify-content:center;
  color: rgba(17,24,39,.55);
  font-weight: 700;
}
.title{
  margin: 0;
  font-size: clamp(20px, 2.2vw, 30px);
}
.desc{
  margin: 6px 0 0;
  color: rgba(17,24,39,.62);
}
.actions{
  margin-top: 12px;
  display:flex;
  justify-content:center;
  gap: 10px;
  flex-wrap: wrap;
}
@media (min-width: 920px){
  .hero-inner{
    grid-template-columns: 1.25fr 1fr;
    align-items: center;
  }
  .actions{ justify-content:flex-start; }
}

.hero-media.swipe{
  border-radius: 16px;
  overflow: hidden;
}

/* 橫向滑動容器 */
.swipe-track{
  display: flex;
  gap: 0;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

/* 隱藏捲軸（視覺乾淨） */
.swipe-track::-webkit-scrollbar{
  display: none;width: 100%;
  scroll-behavior: smooth;
  scroll-padding-left: 0px;
}

/* 每一張圖就是一頁 */
.hero-img{
  flex: 0 0 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  scroll-snap-align: start;
  user-select: none;
  pointer-events: none; /* 防止拖曳時選到圖片 */
}

</style>
