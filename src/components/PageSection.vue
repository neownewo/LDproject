<template>
  <section :id="id" class="section">
    <div class="section-inner">
      <div class="eyebrow" v-if="eyebrow">{{ eyebrow }}</div>
      <h2 class="title">{{ title }}</h2>
      <p class="desc" v-if="desc">{{ desc }}</p>
      <div class="body">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  id: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
})
</script>

<style scoped>
.section{
  width: min(980px, 100%); margin: 0 auto;
}
.section-inner{
  background: rgba(255,255,255,.86);
  border: 1px solid rgba(17,24,39,.10);
  border-radius: 18px;
  padding: clamp(16px, 2.2vw, 22px);
  box-shadow: 0 12px 32px rgba(17,24,39,.08);
}
.eyebrow{ font-size:12px; letter-spacing:.12em; text-transform:uppercase; color: rgba(17,24,39,.55); }
.title{ margin: 6px 0 6px; font-size: clamp(18px, 2.1vw, 26px); }
.desc{ margin: 0 0 12px; color: rgba(17,24,39,.62); }
</style>
