<template>
  <header class="topbar">
    <div class="wrap">
      <router-link to="/" class="brand">
        <span class="logo"></span>
        <span class="name">{{ title }}</span>
      </router-link>

      <nav class="nav desktop">
        <a v-for="s in sections" :key="s.id" class="link" :href="`#${s.id}`">{{ s.title }}</a>
      </nav>

      <button class="btn mobile" @click="open = !open" aria-label="menu">☰</button>
    </div>

    <div v-if="open" class="mobileMenu">
      <a v-for="s in sections" :key="s.id" class="mLink" :href="`#${s.id}`" @click="open=false">
        {{ s.title }}
      </a>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
defineProps({
  title: { type: String, required: true },
  sections: { type: Array, required: true },
})
const open = ref(false)
</script>

<style scoped>
.topbar{
  position: sticky; top: 0; z-index: 50;
  background: rgba(247,249,255,.78);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(17,24,39,.08);
}
.wrap{
  max-width: 1100px; margin: 0 auto; padding: 12px 18px;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
}
.brand{ display:flex; align-items:center; gap:10px; text-decoration:none; }
.logo{
  width: 12px; height: 12px; border-radius: 50%;
  background: linear-gradient(135deg, #6d5cff, #00c2ff);
  box-shadow: 0 0 0 6px rgba(109,92,255,.14);
}
.name{ font-weight: 850; letter-spacing:.2px; }

.nav.desktop{ display:none; gap: 10px; }
.link{
  padding: 10px 12px; border-radius: 999px;
  color: rgba(17,24,39,.70);
  border: 1px solid transparent;
  text-decoration:none;
}
.link:hover{ background: rgba(109,92,255,.10); border-color: rgba(109,92,255,.16); }

.mobile{ display:inline-flex; }

.mobileMenu{
  max-width: 1100px; margin: 0 auto; padding: 0 18px 12px;
  display:grid; gap:8px;
}
.mLink{
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid rgba(17,24,39,.10);
  background: rgba(255,255,255,.80);
  text-decoration:none;
}

@media (min-width: 920px){
  .nav.desktop{ display:flex; }
  .mobile{ display:none; }
  .mobileMenu{ display:none; }
}
</style>
