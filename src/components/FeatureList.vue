<template>
  <ul class="list">
    <li v-for="(item, idx) in items" :key="idx" class="item">
      <span class="dot" aria-hidden="true"></span>
      <div class="text">
        <div class="label">{{ item.label }}</div>
        <div class="value" v-if="item.value">{{ item.value }}</div>
      </div>
    </li>
  </ul>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
})
</script>

<style scoped>
.list{ list-style:none; padding:0; margin:0; display:grid; gap:10px; }
.item{ display:flex; gap:10px; align-items:flex-start; }
.dot{
  width: 10px; height: 10px; margin-top: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6d5cff, #00c2ff);
  box-shadow: 0 0 0 6px rgba(109,92,255,.12);
}
.label{ font-weight: 700; }
.value{ color: rgba(17,24,39,.62); font-size: 14px; margin-top: 2px; }
</style>
