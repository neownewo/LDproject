<template>
  <div class="app">
    <TopNav :title="SITE.title" :sections="SITE.sections" />

    <main class="main">
      <div class="stack">
        <router-view />
      </div>
    </main>

    <footer class="footer">
      <span>© {{ new Date().getFullYear() }} {{ SITE.title }}</span>
    </footer>
  </div>
</template>

<script setup>
import TopNav from '../components/TopNav.vue'
import { SITE } from '../site.config'
</script>

<style scoped>
.main{
  max-width: 1100px;
  margin: 0 auto;
  padding: 18px;
}
.stack{
  display:grid;
  gap: 14px;
  justify-items: center; /* 你要的：重點區塊置中 */
}
.footer{
  padding: 22px 18px;
  text-align:center;
  color: rgba(17,24,39,.55);
}
</style>
