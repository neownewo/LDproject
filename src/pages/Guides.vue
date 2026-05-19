<template>
  <AppLayout>
    <section id="guides" class="guide-hero">
      <p class="eyebrow">GUIDE</p>

      <div class="hero-title-row">
        <h1>攻略整理</h1>

        <a
          class="submit-button"
          :href="GOOGLE_FORM_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          攻略文章投稿
        </a>
      </div>

      <p class="guide-desc">整理新手入門、養成方向、重點與常用資料。</p>
    </section>
    <section id="guide-filter" class="guide-search-panel">
      <label class="search-box">
        <span>搜尋攻略</span>
        <input v-model.trim="keyword" type="search" placeholder="輸入攻略關鍵字" />
      </label>
    </section>

    <div v-if="loading" class="empty-state status-state">
      攻略資料讀取中…
    </div>

    <div v-else-if="errorMessage" class="empty-state status-state error-state">
      {{ errorMessage }}
    </div>

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
              <span v-if="guide.writer">✦ {{ guide.writer }}</span>
            </div>

            <h3>{{ guide.title }}</h3>
            <p>{{ guide.summary }}</p>

            <div v-if="guide.tags?.length" class="tag-list">
              <span v-for="tag in guide.tags" :key="tag">#{{ tag }}</span>
            </div>

            <router-link
              v-if="guide.link"
              class="guide-link"
              :to="{
                path: '/guide-post',
                query: {
                  url: guide.link,
                  title: guide.title,
                  category: guide.category,
                  date: guide.date,
                  writer: guide.writer
                }
              }"
            >
              查看攻略
            </router-link>
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
import '../styles/common.css'
import { SITE } from '../site.config'
import { computed, ref, onMounted } from 'vue'
import AppLayout from './AppLayout.vue'

const sectionOrder = [
  '新手獵人必看',
  '中級獵人必看',
  '高級獵人必看',
  '休閒獵人必看',
]

function normalizeSectionName(value) {
  const text = String(value || '').trim()

  if (text.includes('新手')) return '新手獵人必看'
  if (text.includes('中級')) return '中級獵人必看'
  if (text.includes('高級')) return '高級獵人必看'
  if (text.includes('休閒')) return '休閒獵人必看'

  return text || '其他攻略'
}

function getSectionOrderIndex(sectionName) {
  const normalized = normalizeSectionName(sectionName)
  const index = sectionOrder.indexOf(normalized)
  return index === -1 ? sectionOrder.length : index
}

const keyword = ref('')
const guides = ref([])
const loading = ref(true)
const errorMessage = ref('')

// 攻略投稿 Google 表單連結
// 兩種名稱都支援：guideForm / guideSubmit，避免 config 命名不同造成讀不到
const GOOGLE_FORM_URL = SITE.forms?.guideForm || SITE.forms?.guideSubmit || ''

// Google Sheet：遊戲攻略投稿表單
// 新欄位對應：
// 類別 / 攻略標題 / 作者名稱 / 文章上傳日 / 簡介 / 關鍵字 / 文章縮圖連結固定勾選即可 / 文章連結 / status
const SHEET_API_URL = SITE.sheets.guides

const guideSections = computed(() => {
  const text = keyword.value.toLowerCase()

  const filtered = guides.value.filter((guide) => {
    const searchTarget = [
      guide.section,
      guide.level,
      guide.title,
      guide.summary,
      guide.category,
      guide.date,
      guide.writer,
      ...(guide.tags || []),
    ]
      .join(' ')
      .toLowerCase()

    return !text || searchTarget.includes(text)
  })

  const groupMap = new Map()

  filtered.forEach((guide) => {
    const sectionName = getSectionName(guide)

    if (!groupMap.has(sectionName)) {
      groupMap.set(sectionName, {
        id: `guide-${slugify(sectionName)}`,
        level: sectionName,
        title: getSectionTitle(sectionName),
        description: getSectionDescription(sectionName),
        items: [],
        firstOrder: guide.sheetOrder,
      })
    }

    groupMap.get(sectionName).items.push(guide)
  })

  return Array.from(groupMap.values())
    .sort((a, b) => {
      const orderDiff = getSectionOrderIndex(a.level) - getSectionOrderIndex(b.level)
      if (orderDiff !== 0) return orderDiff

      return a.firstOrder - b.firstOrder
    })
    .map((group) => ({
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

    guides.value = data
      .filter((item) => {
        const normalized = normalizeGuide(item)
        const hasContent = normalized.title || normalized.summary || normalized.link || normalized.route

        // 有 status 欄位時，只顯示 approved；沒有 status 欄位時，先允許顯示，方便舊資料相容
        const status = String(item.status || item.Status || item.審核狀態 || '').trim().toLowerCase()
        const isApproved = !status || status === 'approved'

        return hasContent && isApproved
      })
      .map((item, index) => normalizeGuide(item, index))
  } catch (error) {
    console.error(error)
    errorMessage.value = '攻略資料讀取失敗，請稍後再試。'
  } finally {
    loading.value = false
  }
})

function normalizeGuide(item, index = 0) {
  const category = getField(item, [
    '類別',
    'category',
    '分類',
    'section',
    'level',
    '區塊',
  ])

  const title = getField(item, [
    '攻略標題',
    'title',
    '標題',
  ])

  const writer = normalizeWriter(
    getField(item, [
      '作者名稱',
      'writer',
      '作者',
      '撰寫者',
    ])
  )

  const date = formatSheetDate(
    getField(item, [
      '文章上傳日',
      'date',
      '日期',
      '上傳日',
    ])
  )

  const summary = getField(item, [
    '簡介',
    'summary',
    'description',
    '摘要',
    '說明',
  ])

  const tagText = getField(item, [
    '關鍵字',
    'tags',
    'tag',
    '標籤',
  ])

  const image = getField(item, [
    '文章縮圖連結固定勾選即可',
    'image',
    '圖片',
    '縮圖',
    'thumbnail',
  ])

  const link = getField(item, [
    '文章連結',
    'link',
    'url',
    '連結',
    '文章網址',
  ])

  return {
    sheetOrder: index,
    section: category,
    level: category,
    category,
    date,
    title,
    writer,
    summary,
    tags: parseTags(tagText),
    image,
    link,
    route: String(item.route || '').trim(),
  }
}

function getField(item, keys = []) {
  for (const key of keys) {
    const value = item[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }

  return ''
}

function normalizeWriter(writer) {
  if (!writer) return ''
  return String(writer).replace(/^@/, '').trim()
}

function formatSheetDate(value) {
  if (!value) return ''

  // Excel / Google Sheet 日期序號，例如 46158
  if (!Number.isNaN(Number(value)) && Number(value) > 30000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + Number(value) * 86400000)
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  return String(value).trim()
}

function getSectionName(guide) {
  return normalizeSectionName(
    guide.section ||
    guide.level ||
    guide.category ||
    guide.tags?.[0] ||
    '其他攻略'
  )
}

function getSectionTitle(sectionName) {
  return normalizeSectionName(sectionName)
}

function getSectionDescription(sectionName) {
  const title = getSectionTitle(sectionName)
  return `${title}整理。`
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean)

  // 關鍵字欄位統一使用英文逗號 , 分隔
  // 範例：抽卡,新手,五星推薦
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
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

.hero-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.guide-desc {
  max-width: 720px;
  margin: 14px 0 0;
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
  display: flex;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 4px 14px;
  scroll-snap-type: x mandatory;
  scroll-padding-left: 4px;
  -webkit-overflow-scrolling: touch;
}

.guide-grid::-webkit-scrollbar {
  height: 8px;
}

.guide-grid::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.58);
}

.guide-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(184, 217, 255, 0.9);
}

.guide-card {
  flex: 0 0 clamp(240px, 34vw, 320px);
  overflow: hidden;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 26px rgba(31, 41, 55, 0.07);
  scroll-snap-align: start;
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
  display: flex;
  min-height: 230px;
  flex-direction: column;
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
  margin-top: auto;
  padding-top: 14px;
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

  .guide-toolbar {
    display: grid;
  }

  .hero-title-row {
    align-items: flex-start;
    flex-direction: column;
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
    gap: 12px;
    margin-right: -18px;
    padding-right: 18px;
  }

  .guide-card {
    flex-basis: min(82vw, 300px);
  }
}

.submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 10px 18px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.88), rgba(167, 139, 250, 0.9));
  box-shadow: 0 10px 22px rgba(99, 102, 241, 0.18);
  color: #fff;
  font-size: 14px;
  font-weight: 900;
  text-decoration: none;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.submit-button:hover {
  transform: translateY(-1px);
  opacity: 0.92;
}
</style>
