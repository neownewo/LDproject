<template>
  <AppLayout>
    <section id="events" class="events-hero">
      <p class="eyebrow">FAN EVENTS</p>

      <div class="hero-title-row">
        <h1>應援活動資訊</h1>

        <a
          class="submit-button"
          :href="GOOGLE_FORM_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          應援活動投稿
        </a>
      </div>

      <p class="events-desc">
        整理《戀與深空》各地應援活動，包含電視牆應援、茶會與其他粉絲企劃。
      </p>
    </section>

    <section id="events-filter" class="events-search-panel">
      <label class="search-box">
        <span>搜尋</span>
        <input
          v-model.trim="keyword"
          type="search"
          placeholder="輸入活動名稱、角色、地點、帳號或地址"
        />
      </label>

      <div class="filter-row">
        <label class="select-box">
          <span>角色</span>
          <select v-model="selectedCharacter">
            <option value="全部">全部</option>
            <option v-for="character in characterOptions" :key="character" :value="character">
              {{ character }}
            </option>
          </select>
        </label>

        <label class="select-box">
          <span>地區</span>
          <select v-model="selectedArea">
            <option value="全部">全部</option>
            <option v-for="area in areaOptions" :key="area" :value="area">
              {{ area }}
            </option>
          </select>
        </label>

        <label class="select-box">
          <span>類型</span>
          <select v-model="selectedType">
            <option value="全部">全部</option>
            <option v-for="type in typeOptions" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <div v-if="loading" class="empty-state status-state">
      資料讀取中…
    </div>

    <div v-else-if="errorMessage" class="empty-state status-state error-state">
      {{ errorMessage }}
    </div>

    <section v-else class="events-panel">
      <div class="events-toolbar">
        <div>
          <h2>活動列表</h2>
          <p>僅顯示已審核通過、尚未過期的應援活動。</p>
        </div>
      </div>

      <div v-if="filteredEvents.length" class="events-grid">
        <article v-for="event in filteredEvents" :key="event.id" class="events-card">
          <div v-if="event.image" class="event-image-wrap">
            <img class="event-image" :src="event.image" :alt="event.title" loading="lazy" />
          </div>

          <div class="events-meta">
            <span>{{ event.character || '未分類角色' }}</span>
            <span>{{ event.area || '未分類地區' }}</span>
            <span>{{ event.type || '其他' }}</span>
          </div>

          <h3>{{ event.title }}</h3>

          <p class="event-date">
            {{ formatDate(event.startDate) }}
            <template v-if="event.endDate && event.endDate !== event.startDate">
              ～ {{ formatDate(event.endDate) }}
            </template>
          </p>

          <p v-if="event.officialName || event.officialUrl" class="event-info">
            <strong>官方帳號：</strong>
            <a
              v-if="event.officialUrl"
              class="official-link"
              :href="event.officialUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ event.officialName || '查看官方 Threads' }}
            </a>
            <span v-else>{{ event.officialName }}</span>
          </p>

          <p v-if="event.address" class="event-info">
            <strong>地址：</strong>{{ event.address }}
          </p>

          <p v-if="event.note" class="event-note">{{ event.note }}</p>

          <iframe
            v-if="event.address"
            class="card-map"
            :src="getSingleMapUrl(event.address)"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </article>
      </div>

      <div v-else class="empty-state">
        目前沒有符合條件的活動，可以換個關鍵字或篩選條件試試。
      </div>
    </section>

    <section class="events-panel map-panel">
      <div class="events-toolbar">
        <div>
          <h2>應援活動統整地圖</h2>
          <p>地圖由站長定期依照審核通過的活動資訊手動更新，非即時資料。</p>
        </div>
      </div>

      <iframe
        class="overview-map"
        src="https://www.google.com/maps/d/u/1/embed?mid=1XDOp0OR7O0ZU83lKrFiJOcVadFcJ0L4&ehbc=2E312F"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </section>
  </AppLayout>
</template>

<script setup>
import '../styles/common.css'
import { SITE } from '../site.config'
import { computed, onMounted, ref } from 'vue'
import AppLayout from './AppLayout.vue'

const keyword = ref('')
const selectedCharacter = ref('全部')
const selectedArea = ref('全部')
const selectedType = ref('全部')
const events = ref([])
const loading = ref(true)
const errorMessage = ref('')

// Google Form：請改成你的活動投稿表單連結
const GOOGLE_FORM_URL =  SITE.forms.eventForm

// Google Sheet：請改成你的 opensheet API URL
// 格式：https://opensheet.elk.sh/你的SheetID/應援活動回覆
const SHEET_API_URL = SITE.sheets.events

const characterOptions = computed(() => getUniqueOptions('character'))
const areaOptions = computed(() => getUniqueOptions('area'))
const typeOptions = computed(() => getUniqueOptions('type'))

const filteredEvents = computed(() => {
  const text = keyword.value.toLowerCase()

  return events.value.filter((event) => {
    const matchCharacter = selectedCharacter.value === '全部' || event.character === selectedCharacter.value
    const matchArea = selectedArea.value === '全部' || event.area === selectedArea.value
    const matchType = selectedType.value === '全部' || event.type === selectedType.value

    const searchTarget = [
      event.title,
      event.character,
      event.area,
      event.type,
      event.officialName,
      event.officialUrl,
      event.address,
      event.note,
    ]
      .join(' ')
      .toLowerCase()

    const matchKeyword = !text || searchTarget.includes(text)

    return matchCharacter && matchArea && matchType && matchKeyword
  })
})

onMounted(async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const res = await fetch(SHEET_API_URL)
    if (!res.ok) throw new Error(`Google Sheet 資料讀取失敗：${res.status}`)

    const data = await res.json()
    events.value = data
      .filter((item) => normalizeStatus(getField(item, ['status', '審核狀態'])) === 'approved')
      .map(normalizeEvent)
      .filter((item) => item.title || item.address)
      .filter((item) => !isEventExpired(item.endDate))
      .sort(sortEvents)
  } catch (error) {
    console.error(error)
    errorMessage.value = '應援活動資料讀取失敗，請稍後再試。'
  } finally {
    loading.value = false
  }
})

function normalizeEvent(item, index) {
  const title = getField(item, ['應援活動名稱', 'title', '活動名稱', 'name'])
  const character = getField(item, ['應援角色', 'character', '角色'])
  const startDate = getField(item, ['活動開始日期', 'startDate', '開始日期'])
  const endDate = getField(item, ['活動結束日期', 'endDate', '結束日期'])
  const area = getField(item, ['地區分類', 'area', '地區'])
  const type = getField(item, ['活動類型', 'type', '類型'])
  const officialName = getField(item, ['官方帳號名稱(threads)', 'officialName', '官方帳號名稱', '官方帳號', 'officialAccount'])
  const officialUrl = normalizeUrl(getField(item, ['官方 Threads 連結(直接貼網址)', 'officialUrl', '官方Threads連結', 'Threads連結', 'sourceUrl', 'link']))
  const address = getField(item, ['完整地址', 'address', '活動完整地址'])
  const note = getField(item, ['活動說明', 'note', '說明', 'summary', 'description'])
  const image = normalizeUrl(getField(item, ['活動主視覺圖片 (圖片的URL網址)', 'image', '圖片', '圖片網址']))

  return {
    id: `${title || 'event'}-${index}`,
    title: title || '未命名活動',
    character,
    startDate,
    endDate,
    area: area || '未分類',
    type: type || '其他',
    officialName,
    officialUrl,
    address,
    note,
    image,
  }
}

function getField(item, names) {
  const normalizedMap = Object.entries(item).reduce((map, [key, value]) => {
    map[normalizeKey(key)] = value
    return map
  }, {})

  for (const name of names) {
    const value = normalizedMap[normalizeKey(name)]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }

  return ''
}

function normalizeKey(value) {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase()
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase()
}

function isEventExpired(endDateValue) {
  // 不再讀取 expired 欄位，直接依「活動結束日期」判斷是否過期。
  // 結束日期當天仍會顯示，隔天才隱藏。
  const endDate = parseDate(endDateValue)

  // 沒有填結束日期時先保留顯示，避免投稿資料因缺漏直接消失。
  if (!endDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  endDate.setHours(23, 59, 59, 999)

  return endDate < today
}

function normalizeUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  return ''
}

function getSingleMapUrl(address) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

function getUniqueOptions(field) {
  const set = new Set(events.value.map((event) => event[field]).filter(Boolean))
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'))
}

function sortEvents(a, b) {
  const dateA = parseDate(a.startDate)
  const dateB = parseDate(b.startDate)

  if (dateA && dateB) return dateA - dateB
  if (dateA) return -1
  if (dateB) return 1

  return a.title.localeCompare(b.title, 'zh-Hant')
}

function parseDate(value) {
  if (!value) return null

  // Google Sheet / opensheet 可能回傳 2026/4/18、2026-04-18，或 Date 字串
  const normalized = String(value).trim().replace(/\//g, '-')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  if (!value) return '日期未定'

  const date = parseDate(value)
  if (!date) return value

  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}
</script>

<style scoped>
/* Events 頁內容：沿用 Sunteam 頁的 AppLayout 包法與卡片結構 */
.events-hero,
.events-search-panel,
.events-panel {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 42px rgba(31, 41, 55, 0.08);
}

.events-hero {
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

.hero-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.events-hero h1 {
  margin: 0;
  color: rgba(17, 24, 39, 0.92);
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.18;
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

.events-desc {
  max-width: 720px;
  margin: 12px 0 0;
  color: rgba(75, 85, 99, 0.9);
  line-height: 1.8;
}

.events-search-panel,
.events-panel {
  padding: 22px;
}

.events-search-panel,
.events-panel {
  margin-bottom: 18px;
}

.events-search-panel {
  display: grid;
  gap: 16px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.search-box,
.select-box {
  display: grid;
  gap: 6px;
  min-width: min(260px, 100%);
  color: rgba(75, 85, 99, 0.9);
  font-size: 13px;
  font-weight: 800;
}

.search-box input,
.select-box select {
  width: 100%;
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.95);
  color: rgba(17, 24, 39, 0.9);
  outline: none;
}

.search-box input:focus,
.select-box select:focus {
  border-color: rgba(184, 217, 255, 1);
  box-shadow: 0 0 0 4px rgba(184, 217, 255, 0.28);
}

.events-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.events-toolbar h2 {
  margin: 0 0 6px;
  color: rgba(17, 24, 39, 0.9);
  font-size: 22px;
}

.events-toolbar p {
  margin: 0;
  color: rgba(107, 114, 128, 0.92);
}

.events-grid {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 4px 14px;
  scroll-snap-type: x mandatory;
  scroll-padding-left: 4px;
  -webkit-overflow-scrolling: touch;
}

.events-grid::-webkit-scrollbar {
  height: 8px;
}

.events-grid::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.58);
}

.events-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(184, 217, 255, 0.9);
}

.events-card {
  flex: 0 0 clamp(300px, 38vw, 400px);
  display: flex;
  min-height: 300px;
  flex-direction: column;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 26px rgba(31, 41, 55, 0.07);
  scroll-snap-align: start;
}

.event-image-wrap {
  overflow: hidden;
  border-radius: 16px;
  margin-bottom: 14px;
  background: rgba(243, 244, 246, 0.9);
  aspect-ratio: 16 / 9;
}

.event-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.events-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  color: rgba(107, 114, 128, 0.9);
  font-size: 12px;
  font-weight: 800;
}

.events-meta span {
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(246, 199, 216, 0.26);
}

.events-card h3 {
  margin: 0 0 10px;
  color: rgba(17, 24, 39, 0.92);
  font-size: 18px;
  line-height: 1.35;
}

.event-date {
  margin: 0 0 12px;
  color: rgba(79, 70, 229, 0.9);
  font-weight: 900;
}

.event-info,
.event-note {
  margin: 0 0 8px;
  color: rgba(75, 85, 99, 0.9);
  line-height: 1.7;
}

.event-info strong {
  color: rgba(17, 24, 39, 0.86);
}

.official-link {
  color: rgba(79, 70, 229, 0.94);
  font-weight: 900;
  text-decoration: none;
}

.official-link:hover {
  text-decoration: underline;
}

.event-note {
  margin-top: 4px;
}

.card-map {
  width: 100%;
  height: 180px;
  border: 0;
  border-radius: 18px;
  margin-top: 12px;
  background: rgba(243, 244, 246, 0.9);
}

.overview-map {
  width: 100%;
  height: 520px;
  border: 0;
  border-radius: 20px;
  background: rgba(243, 244, 246, 0.9);
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
  .events-toolbar,
  .filter-row {
    display: grid;
  }
}

@media (max-width: 520px) {
  .events-hero,
  .events-search-panel,
  .events-panel {
    border-radius: 18px;
    padding: 18px;
  }

  .hero-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .events-grid {
    gap: 12px;
    margin-right: -18px;
    padding-right: 18px;
  }

  .events-card {
    flex-basis: min(86vw, 340px);
  }

  .card-map {
    height: 170px;
  }

  .overview-map {
    height: 360px;
  }
}
</style>
