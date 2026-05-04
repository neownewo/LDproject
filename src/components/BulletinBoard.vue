<template>
  <section class="board">
    <div class="pin pin-1"></div>
    <div class="pin pin-2"></div>

    <div class="board-inner">
      <div class="header">
        <h2 class="title">{{ title }}</h2>
        <div class="right"><slot name="right" /></div>
      </div>

      <div class="content">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
})
</script>

<style scoped>
.board{
  width: min(980px, 100%);margin: 0 auto;
  position: relative;
  border-radius: 18px;
  padding: 14px;
  background:
    radial-gradient(1200px 700px at 20% 0%, rgba(109,92,255,.16), transparent 55%),
    radial-gradient(900px 600px at 85% 15%, rgba(0,194,255,.14), transparent 55%),
    linear-gradient(180deg, rgba(255,255,255,.80), rgba(255,255,255,.92));
  border: 1px solid rgba(17,24,39,.10);
  box-shadow: 0 18px 40px rgba(17,24,39,.10);
}

/* 像佈告欄的「釘子」 */
.pin{
  width: 14px; height: 14px;
  border-radius: 50%;
  position: absolute; top: 10px;
  background: linear-gradient(135deg, #6d5cff, #00c2ff);
  box-shadow: 0 6px 18px rgba(17,24,39,.18);
}
.pin-1{ left: 14px; }
.pin-2{ right: 14px; }

.board-inner{
  border-radius: 14px;
  background: rgba(255,255,255,.82);
  border: 1px dashed rgba(17,24,39,.18);
  padding: 14px;
}

.header{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(17,24,39,.08);
}
.title{
  margin: 0;
  font-size: clamp(18px, 2vw, 22px);
}
.content{
  padding-top: 12px;
}

/* 手機時右側按鈕換行 */
@media (max-width: 520px){
  .header{ flex-direction: column; align-items: stretch; }
  .right{ display:flex; justify-content:flex-start; }
}
</style>
