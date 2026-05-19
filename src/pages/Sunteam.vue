<template>
  <AppLayout>
    <section id="sunteam" class="sunteam-hero">
      <p class="eyebrow">SUNTEAM</p>
      <h1>日卡套組</h1>
      <p class="sunteam-desc">
        整理所有男主日卡套裝介紹。
      </p>
    </section>

    <section id="sunteam-filter" class="sunteam-search-panel">
      <label class="search-box">
        <span>搜尋</span>
        <input v-model.trim="keyword" type="search" placeholder="輸入關鍵字" />
      </label>
    </section>

    <div v-if="loading" class="empty-state status-state">
      資料讀取中…
    </div>

    <div v-else-if="errorMessage" class="empty-state status-state error-state">
      {{ errorMessage }}
    </div>

    <section
      v-else
      v-for="section in sunteamSections"
      :key="section.level"
      :id="section.id"
      class="sunteam-panel"
    >
      <div class="sunteam-toolbar">
        <div>
          <h2>{{ section.title }}</h2>
          <p>{{ section.description }}</p>
        </div>
      </div>

      <div v-if="section.items.length" class="sunteam-grid">
        <article v-for="sunteam in section.items" :key="sunteam.title" class="sunteam-card">
          <div v-if="sunteam.image" class="sunteam-thumb-wrap">
            <img class="sunteam-thumb" :src="sunteam.image" :alt="sunteam.title" loading="lazy" />
          </div>

          <div class="sunteam-card-body">
            <div class="sunteam-meta">
              <span>{{ sunteam.category }}</span>
              <span v-if="sunteam.date">{{ sunteam.date }}</span>
            </div>

            <h3>{{ sunteam.cardTitle }}</h3>
            <p v-if="sunteam.description">{{ sunteam.description }}</p>

            <div v-if="sunteam.tags?.length" class="tag-list">
              <span v-for="tag in sunteam.tags" :key="tag">#{{ tag }}</span>
            </div>

            <router-link
              v-if="sunteam.link"
              class="sunteam-link"
              :to="{
                path: '/sunteam-post',
                query: {
                  url: sunteam.link,
                  title: sunteam.cardTitle,
                  category: sunteam.category,
                  date: sunteam.date
                }
              }"
            >
              查看
            </router-link>
            <router-link v-else-if="sunteam.route" class="sunteam-link" :to="sunteam.route">
              查看
            </router-link>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        目前沒有符合條件的資料，可以換個關鍵字試試。
      </div>
    </section>
  </AppLayout>
</template>

<script setup>
import '../styles/common.css'
import { SITE } from '../site.config'
import { computed, ref, onMounted } from 'vue'
import AppLayout from './AppLayout.vue'

const keyword = ref('')
const sunteams = ref([])
const loading = ref(true)
const errorMessage = ref('')

// Google Sheet：男主日卡套裝
// 欄位：level / title / summary / tags / image / link / route
const SHEET_API_URL =  SITE.sheets.sunteam

const sunteamSections = computed(() => {
  const text = keyword.value.toLowerCase()
  const filtered = sunteams.value.filter((sunteam) => {
    const searchTarget = [
      sunteam.level,
      sunteam.title,
      sunteam.cardTitle,
      sunteam.description,
      sunteam.category,
      ...(sunteam.tags || []),
    ]
      .join(' ')
      .toLowerCase()

    return !text || searchTarget.includes(text)
  })

  const groupMap = new Map()

  filtered.forEach((sunteam) => {
    const level = sunteam.level || '其他'

    if (!groupMap.has(level)) {
      groupMap.set(level, {
        id: `sunteam-${slugify(level)}`,
        level,
        title: getGroupTitle(level, sunteam),
        description: getGroupDescription(level),
        items: [],
      })
    }

    groupMap.get(level).items.push(sunteam)
  })

  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    items: group.items.sort((a, b) => a.sheetOrder - b.sheetOrder),
  }))
})

onMounted(async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const res = await fetch(SHEET_API_URL)
    if (!res.ok) throw new Error(`Google Sheet 資料讀取失敗：${res.status}`)

    const data = await res.json()
    sunteams.value = data
      .filter((item) => item.level || item.title || item.summary)
      .map((item, index) => normalizeSunteam(item, index))
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Sunteam 資料讀取失敗，請稍後再試。'
  } finally {
    loading.value = false
  }
})

function normalizeSunteam(item, index = 0) {
  const level = String(item.level || '').trim()
  const title = String(item.title || '').trim()
  const summary = String(item.summary || '').trim()

  return {
    sheetOrder: index,
    level,
    // title 欄位在你的 Sheet 目前是男主名稱，例如：沈星回 / 黎深
    title,
    // category 沒有填時，用 level 或男主名稱當分類，避免畫面空白
    category: String(item.category || level || title || '').trim(),
    date: String(item.date || '').trim(),
    // summary 欄位目前是卡名，例如：沈星回·末夜，所以卡片主標優先用 summary
    cardTitle: summary || title || '未命名日卡',
    // 保留 description 給未來如果你新增說明欄位時可直接顯示
    description: String(item.description || item.desc || '').trim(),
    tags: parseTags(item.tags),
    image: String(item.image || '').trim(),
    link: String(item.link || '').trim(),
    route: String(item.route || '').trim(),
  }
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean)

  return String(value || '')
    .split(/[、，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function getGroupTitle(level, firstItem) {
  const nameMap = {
    Aster: '沈星回',
    Zayne: '黎深',
    Rafayel: '祁煜',
    Sylus: '秦徹',
    Caleb: '夏以晝',
  }

  return nameMap[level] || firstItem?.title || level || '其他'
}

function getGroupDescription(level) {
  const name = getGroupTitle(level)
  return `${name}日卡套裝整理。`
}


function slugify(value) {
  return String(value || 'other')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\u4e00-\u9fa5]/gi, '') || 'other'
}
</script>

<style scoped>
/* Sunteam 頁內容 */
.sunteam-hero,
.sunteam-search-panel,
.sunteam-panel {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 42px rgba(31, 41, 55, 0.08);
}

.sunteam-hero {
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

.sunteam-hero h1 {
  margin: 0;
  color: rgba(17, 24, 39, 0.92);
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.18;
}

.sunteam-desc {
  max-width: 720px;
  margin: 12px 0 0;
  color: rgba(75, 85, 99, 0.9);
  line-height: 1.8;
}

.sunteam-search-panel,
.sunteam-panel {
  padding: 22px;
}

.sunteam-search-panel {
  margin-bottom: 18px;
}

.sunteam-panel {
  margin-bottom: 18px;
}

.sunteam-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.sunteam-toolbar h2 {
  margin: 0 0 6px;
  color: rgba(17, 24, 39, 0.9);
  font-size: 22px;
}

.sunteam-toolbar p {
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

.sunteam-grid {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 4px 14px;
  scroll-snap-type: x mandatory;
  scroll-padding-left: 4px;
  -webkit-overflow-scrolling: touch;
}

.sunteam-grid::-webkit-scrollbar {
  height: 8px;
}

.sunteam-grid::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.58);
}

.sunteam-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(184, 217, 255, 0.9);
}

.sunteam-card {
  flex: 0 0 clamp(240px, 34vw, 320px);
  overflow: hidden;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 26px rgba(31, 41, 55, 0.07);
  scroll-snap-align: start;
}

.sunteam-thumb-wrap {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: rgba(243, 244, 246, 0.9);
}

.sunteam-thumb {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.sunteam-card-body {
  display: flex;
  min-height: 230px;
  flex-direction: column;
  padding: 16px;
}

.sunteam-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: rgba(107, 114, 128, 0.9);
  font-size: 12px;
  font-weight: 800;
}

.sunteam-card h3 {
  margin: 0 0 8px;
  color: rgba(17, 24, 39, 0.92);
  font-size: 18px;
  line-height: 1.35;
}

.sunteam-card p {
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

.sunteam-link {
  display: inline-flex;
  margin-top: auto;
  padding-top: 14px;
  color: rgba(79, 70, 229, 0.94);
  font-weight: 900;
  text-decoration: none;
}

.sunteam-link:hover {
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

.status-state {
  margin-bottom: 18px;
}

.error-state {
  border-color: rgba(248, 113, 113, 0.55);
  background: rgba(254, 242, 242, 0.92);
  color: rgba(153, 27, 27, 0.92);
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

  .sunteam-toolbar {
    display: grid;
  }
}

@media (max-width: 520px) {
  .sunteam-hero,
  .sunteam-search-panel,
  .sunteam-panel {
    border-radius: 18px;
  }

  .sunteam-hero,
  .sunteam-search-panel,
  .sunteam-panel {
    padding: 18px;
  }

  .sunteam-grid {
    gap: 12px;
    margin-right: -18px;
    padding-right: 18px;
  }

  .sunteam-card {
    flex-basis: min(82vw, 300px);
  }
}
</style>
