<template>
  <AppLayout>
    <section id="guides" class="guide-hero">
      <p class="eyebrow">GUIDE</p>
      <h1>攻略整理</h1>
      <p class="guide-desc">
        整理新手入門、養成方向、活動重點與常用資料。之後可以改成讀取 JSON 或 Google Sheet，讓內容維護更輕鬆。
      </p>
    </section>

    <section id="guide-filter" class="guide-search-panel">
      <label class="search-box">
        <span>搜尋攻略</span>
        <input v-model.trim="keyword" type="search" placeholder="輸入攻略關鍵字" />
      </label>
    </section>

    <div v-if="isLoading" class="empty-state">攻略資料讀取中...</div>
    <div v-else-if="loadError" class="empty-state">{{ loadError }}</div>

    <section
      v-else
      v-for="section in guideSections"
      :key="section.level"
      :id="section.id"
      class="guide-panel"
    >
      <div class="guide-toolbar">
        <div>
          <h2>{{ section.title }}</h2>
          <p>{{ section.description }}</p>
        </div>
      </div>

      <div v-if="section.items.length" class="guide-grid">
        <article v-for="guide in section.items" :key="guide.title" class="guide-card">
          <div v-if="guide.image" class="guide-thumb-wrap">
            <img class="guide-thumb" :src="guide.image" :alt="guide.title" loading="lazy" />
          </div>

          <div class="guide-card-body">
            <div class="guide-meta">
              <span>{{ guide.category }}</span>
              <span v-if="guide.date">{{ guide.date }}</span>
            </div>

            <h3>{{ guide.title }}</h3>
            <p>{{ guide.summary }}</p>

            <div v-if="guide.tags?.length" class="tag-list">
              <span v-for="tag in guide.tags" :key="tag">#{{ tag }}</span>
            </div>

            <a v-if="guide.link" class="guide-link" :href="guide.link" target="_blank" rel="noopener noreferrer">
              查看攻略
            </a>
            <router-link v-else-if="guide.route" class="guide-link" :to="guide.route">
              查看攻略
            </router-link>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        目前沒有符合條件的攻略，可以換個關鍵字試試。
      </div>
    </section>
  </AppLayout>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import AppLayout from './AppLayout.vue'
import { guideGroups } from '../guideData'

const keyword = ref('')
const guides = ref([])
const isLoading = ref(false)
const loadError = ref('')

// Google Sheet 請使用「發布到網路」後的 CSV 連結，網址結尾通常會是：pub?output=csv
// 注意：不是 /edit，也不是 pubhtml。
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQY0KD2HeAl1lJHSraPxafcI_s1xJr024Gi0onLab4goXy_LLR7udjsgF-BBxwjdm6EkWxXUL4uvET/pub?output=csv'

const guideSections = computed(() => {
  const text = keyword.value.toLowerCase()

  return guideGroups.map((group) => {
    const items = guides.value.filter((guide) => {
      const matchLevel = guide.level === group.level
      const searchTarget = [guide.title, guide.summary, guide.category, ...(guide.tags || [])]
        .join(' ')
        .toLowerCase()
      const matchKeyword = !text || searchTarget.includes(text)

      return matchLevel && matchKeyword
    })

    return {
      ...group,
      items,
    }
  })
})

function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"'
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i += 1
      row.push(cell.trim())
      if (row.some(value => value !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell.trim())
  if (row.some(value => value !== '')) rows.push(row)

  if (!rows.length) return []

  const headers = rows.shift().map(header => header.trim())

  return rows.map((values) => {
    const item = {}

    headers.forEach((header, index) => {
      item[header] = values[index]?.trim() || ''
    })

    return {
      level: item.level,
      category: item.category,
      date: item.date,
      title: item.title,
      summary: item.summary,
      image: item.image,
      link: item.link,
      route: item.route,
      tags: item.tags
        ? item.tags.split(/[、,，]/).map(tag => tag.trim()).filter(Boolean)
        : [],
    }
  }).filter(item => item.level && item.title)
}

onMounted(async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' })

    if (!res.ok) {
      throw new Error(`讀取 Google Sheet 失敗：${res.status}`)
    }

    const text = await res.text()
    guides.value = parseCSV(text)
  } catch (error) {
    console.error(error)
    loadError.value = '攻略資料讀取失敗，請確認 Google Sheet 已發布成 CSV，且網址結尾是 pub?output=csv。'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
/* 攻略頁內容 */
.guide-hero,
.guide-search-panel,
.guide-panel {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 42px rgba(31, 41, 55, 0.08);
}

.guide-hero {
  padding: 28px;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 8px;
  color: rgba(99, 102, 241, 0.86);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.guide-hero h1 {
  margin: 0;
  color: rgba(17, 24, 39, 0.92);
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.18;
}

.guide-desc {
  max-width: 720px;
  margin: 12px 0 0;
  color: rgba(75, 85, 99, 0.9);
  line-height: 1.8;
}

.guide-search-panel,
.guide-panel {
  padding: 22px;
}

.guide-search-panel {
  margin-bottom: 18px;
}

.guide-panel {
  margin-bottom: 18px;
}

.guide-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.guide-toolbar h2 {
  margin: 0 0 6px;
  color: rgba(17, 24, 39, 0.9);
  font-size: 22px;
}

.guide-toolbar p {
  margin: 0;
  color: rgba(107, 114, 128, 0.92);
}

.search-box {
  display: grid;
  gap: 6px;
  min-width: min(260px, 100%);
  color: rgba(75, 85, 99, 0.9);
  font-size: 13px;
  font-weight: 800;
}

.search-box input {
  width: 100%;
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.95);
  color: rgba(17, 24, 39, 0.9);
  outline: none;
}

.search-box input:focus {
  border-color: rgba(184, 217, 255, 1);
  box-shadow: 0 0 0 4px rgba(184, 217, 255, 0.28);
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.category-tab {
  border: 1px solid rgba(209, 213, 219, 0.9);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.82);
  color: rgba(75, 85, 99, 0.94);
  font-weight: 800;
}

.category-tab.active {
  border-color: transparent;
  background: linear-gradient(135deg, rgba(246, 199, 216, 0.85), rgba(184, 217, 255, 0.9));
  color: rgba(17, 24, 39, 0.86);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
}

.guide-card {
  overflow: hidden;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 26px rgba(31, 41, 55, 0.07);
}

.guide-thumb-wrap {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: rgba(243, 244, 246, 0.9);
}

.guide-thumb {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.guide-card-body {
  padding: 16px;
}

.guide-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: rgba(107, 114, 128, 0.9);
  font-size: 12px;
  font-weight: 800;
}

.guide-card h3 {
  margin: 0 0 8px;
  color: rgba(17, 24, 39, 0.92);
  font-size: 18px;
  line-height: 1.35;
}

.guide-card p {
  margin: 0;
  color: rgba(75, 85, 99, 0.9);
  line-height: 1.7;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.tag-list span {
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(246, 199, 216, 0.26);
  color: rgba(75, 85, 99, 0.92);
  font-size: 12px;
  font-weight: 800;
}

.guide-link {
  display: inline-flex;
  margin-top: 14px;
  color: rgba(79, 70, 229, 0.94);
  font-weight: 900;
  text-decoration: none;
}

.guide-link:hover {
  text-decoration: underline;
}

.empty-state {
  border: 1px dashed rgba(209, 213, 219, 0.95);
  border-radius: 18px;
  padding: 24px;
  background: rgba(249, 250, 251, 0.9);
  color: rgba(107, 114, 128, 0.96);
  text-align: center;
}

@media (max-width: 900px) {
  .home-shell,
  .home-shell.menu-collapsed {
    display: block;
  }

  .mobile-menu-toggle {
    position: sticky;
    top: 10px;
    z-index: 35;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding: 10px 14px;
    border-radius: 999px;
    font-weight: 800;
  }

  .hamburger,
  .hamburger::before,
  .hamburger::after {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 99px;
    background: currentColor;
  }

  .hamburger {
    position: relative;
  }

  .hamburger::before,
  .hamburger::after {
    content: '';
    position: absolute;
    left: 0;
  }

  .hamburger::before {
    top: -6px;
  }

  .hamburger::after {
    top: 6px;
  }

  .mobile-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: block;
    background: rgba(15, 23, 42, 0.28);
  }

  .side-menu {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
    width: min(82vw, 300px);
    height: 100vh;
    min-height: 100vh;
    border-radius: 0 24px 24px 0;
    transform: translateX(-104%);
    transition: transform 0.25s ease;
  }

  .mobile-menu-open .side-menu {
    transform: translateX(0);
  }

  .collapse-toggle {
    display: none;
  }

  .brand-text,
  .menu-label {
    display: inline !important;
  }

  .guide-toolbar {
    display: grid;
  }
}

@media (max-width: 520px) {
  .guide-hero,
  .guide-search-panel,
  .guide-panel {
    border-radius: 18px;
  }

  .guide-hero,
  .guide-search-panel,
  .guide-panel {
    padding: 18px;
  }

  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
