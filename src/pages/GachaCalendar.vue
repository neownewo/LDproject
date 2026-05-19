<template>
  <AppLayout>
    <section class="calendar-hero">
      <div>
        <p class="eyebrow">GACHA CALENDAR</p>
        <h1>卡池月曆</h1>
        <p class="calendar-desc">
          依年份瀏覽單人、多人、日卡池與免費五星時程；可依需求篩選卡池類型，並隱藏復刻或免費五星。<br>
          *電腦版可看到統計數字
        </p>
      </div>

      <label class="year-picker">
        <span>選擇年度</span>
        <select v-model="selectedYear">
          <option v-for="year in yearOptions" :key="year" :value="year">
            {{ year }} 年
          </option>
        </select>
      </label>
    </section>

    <section class="filter-panel">
      <label class="filter-field">
        <span>查詢起日</span>
        <input v-model="filterStartDate" type="date" />
      </label>

      <label class="filter-field">
        <span>查詢迄日</span>
        <input v-model="filterEndDate" type="date" />
      </label>

      <label class="filter-field">
        <span>卡池類型</span>
        <select v-model="selectedType">
          <option value="all">全部</option>
          <option value="single">單人卡池</option>
          <option value="multi">多人卡池</option>
          <option value="daily">日卡池</option>
          <option value="free">免費五星</option>
        </select>
      </label>

      <label class="filter-field">
        <span>登場角色</span>
        <select v-model="selectedCharacter">
          <option value="all">全部角色</option>
          <option v-for="character in characterOptions" :key="character" :value="character">
            {{ character }}
          </option>
        </select>
      </label>

      <label class="rerun-check">
        <input v-model="showRerun" type="checkbox" />
        <span>顯示復刻</span>
      </label>

      <label class="rerun-check">
        <input v-model="hideFreeStar" type="checkbox" />
        <span>隱藏免費五星</span>
      </label>

      <button class="clear-filter-btn" type="button" @click="resetFilters">
        清除篩選
      </button>
    </section>

    <div v-if="loading" class="empty-state status-state">
      卡池資料讀取中…
    </div>

    <div v-else-if="errorMessage" class="empty-state status-state error-state">
      {{ errorMessage }}
    </div>

    <template v-else>
      <section class="calendar-summary">
        <div class="summary-card">
          <span>符合條件</span>
          <strong>{{ filteredPools.length }}</strong>
        </div>
        <div class="summary-card">
          <span>單人卡池</span>
          <strong>{{ singlePoolsCount }}</strong>
        </div>
        <div class="summary-card">
          <span>多人卡池</span>
          <strong>{{ multiPoolsCount }}</strong>
        </div>
        <div class="summary-card">
          <span>日卡池</span>
          <strong>{{ dailyPoolsCount }}</strong>
        </div>
        <div class="summary-card">
          <span>免費五星</span>
          <strong>{{ freeStarPoolsCount }}</strong>
        </div>
      </section>

      <section v-for="month in months" :key="month.value" class="month-panel">
        <div class="month-title-row">
          <div>
            <p class="month-index">{{ selectedYear }} / {{ pad(month.value) }}</p>
            <h2>{{ month.label }}</h2>
          </div>
          <span class="month-count">{{ getMonthPoolCount(month.value) }} 個卡池</span>
        </div>

        <div v-if="poolsByMonth[month.value]?.length" class="timeline-list">
          <div
            v-for="group in poolsByMonth[month.value]"
            :key="group.displayDate"
            class="timeline-day-group"
          >
            <div class="date-rail">
              <strong>{{ group.day }}</strong>
              <span>{{ group.monthDay }}</span>
            </div>

            <div class="timeline-day-pools">
              <article
                v-for="pool in group.pools"
                :key="`${pool.name}-${pool.startDate}-${pool.endDate}`"
                :class="['pool-card', { overlapping: pool.hasOverlap, rerun: pool.isRerun, 'free-star': pool.isFreeStar }]"
              >
                <div class="pool-main">
                  <div class="pool-thumb-area">
                    <template v-if="getPoolImages(pool.image).length">
                      <img
                        class="pool-thumb"
                        :src="getCarouselImage(pool)"
                        :alt="`${pool.name} 縮圖`"
                        loading="lazy"
                      />

                      <div v-if="getPoolImages(pool.image).length > 1" class="carousel-dots">
                        <span
                          v-for="(_, index) in getPoolImages(pool.image)"
                          :key="index"
                          :class="{ active: index === getActiveCarouselIndex(pool.image) }"
                        ></span>
                      </div>
                    </template>

                    <div v-else class="pool-thumb-placeholder">
                      <span>{{ pool.typeLabel }}</span>
                    </div>
                  </div>

                  <div class="pool-card-body">
                    <div class="pool-meta">
                      <span :class="['pool-type', pool.poolType]">
                        {{ pool.typeLabel }}
                      </span>
                      <span v-if="pool.isRerun" class="rerun-badge">
                        復刻
                      </span>
                     
                      <span v-if="pool.hasOverlap" class="overlap-badge">
                        同期重疊
                      </span>
                      <span class="range-text">{{ formatRange(pool.startDate, pool.endDate) }}</span>
                    </div>

                    <h3>{{ pool.name }}</h3>

                    <div v-if="pool.characters.length" class="character-list">
                      <span v-for="character in pool.characters" :key="character">
                        {{ character }}
                      </span>
                    </div>

                    <p v-if="pool.note" class="pool-note">{{ pool.note }}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>

        <div v-else class="empty-month">
          這個月份目前沒有符合條件的卡池。
        </div>
      </section>
    </template>
  </AppLayout>
</template>

<script setup>
import '../styles/common.css'
import { SITE } from '../site.config'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppLayout from './AppLayout.vue'

// 將這裡換成你的 opensheet 網址
// 格式：https://opensheet.elk.sh/你的SheetID/工作表名稱
const SHEET_API_URL =  SITE.sheets.gacha

const loading = ref(true)
const errorMessage = ref('')
const gachaPools = ref([])
const selectedYear = ref(new Date().getFullYear())
const selectedType = ref('all')
const selectedCharacter = ref('all')
const filterStartDate = ref('')
const filterEndDate = ref('')
const showRerun = ref(false)
const hideFreeStar = ref(false)
const carouselIndex = ref(0)
let carouselTimer = null

const months = [
  { value: 1, label: '一月' },
  { value: 2, label: '二月' },
  { value: 3, label: '三月' },
  { value: 4, label: '四月' },
  { value: 5, label: '五月' },
  { value: 6, label: '六月' },
  { value: 7, label: '七月' },
  { value: 8, label: '八月' },
  { value: 9, label: '九月' },
  { value: 10, label: '十月' },
  { value: 11, label: '十一月' },
  { value: 12, label: '十二月' },
]

const yearOptions = computed(() => {
  const years = gachaPools.value.flatMap((pool) =>
    getYearsCovered(pool.startDate, pool.endDate, pool.year)
  )

  const currentYear = new Date().getFullYear()
  return [...new Set([...years, currentYear])].sort((a, b) => b - a)
})

const yearlyPools = computed(() => {
  return gachaPools.value
    .filter((pool) => isPoolActiveInYear(pool, selectedYear.value))
    .sort(comparePools)
})

const characterOptions = computed(() => {
  const characters = yearlyPools.value.flatMap((pool) => pool.characters || [])
  return [...new Set(characters)].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
})

const filteredPools = computed(() => {
  return yearlyPools.value.filter((pool) => {
    const matchType = selectedType.value === 'all' || pool.poolType === selectedType.value
    const matchCharacter =
      selectedCharacter.value === 'all' || pool.characters.includes(selectedCharacter.value)
    const matchDateRange = isInSelectedDateRange(pool)
    const matchRerun = showRerun.value || !pool.isRerun
    const matchFreeStar = !hideFreeStar.value || pool.poolType !== 'free'

    return matchType && matchCharacter && matchDateRange && matchRerun && matchFreeStar
  })
})

const singlePoolsCount = computed(() => filteredPools.value.filter((pool) => pool.poolType === 'single').length)
const multiPoolsCount = computed(() => filteredPools.value.filter((pool) => pool.poolType === 'multi').length)
const dailyPoolsCount = computed(() => filteredPools.value.filter((pool) => pool.poolType === 'daily').length)
const freeStarPoolsCount = computed(() => filteredPools.value.filter((pool) => pool.poolType === 'free').length)

const poolsByMonth = computed(() => {
  const result = months.reduce((acc, month) => {
    acc[month.value] = []
    return acc
  }, {})

  filteredPools.value.forEach((pool) => {
    const activeMonths = getActiveMonths(pool.startDate, pool.endDate, selectedYear.value)
    activeMonths.forEach((month) => {
      result[month]?.push(pool)
    })
  })

  Object.keys(result).forEach((monthKey) => {
    const month = Number(monthKey)
    const markedPools = markOverlaps(result[month].sort((a, b) => comparePoolsByDisplayDate(a, b, month)))
    result[month] = groupPoolsByDisplayDate(markedPools, month)
  })

  return result
})

function getMonthPoolCount(monthValue) {
  return (poolsByMonth.value[monthValue] || []).reduce((sum, group) => sum + group.pools.length, 0)
}

onMounted(async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    startCarouselTimer()

    const res = await fetch(SHEET_API_URL)
    if (!res.ok) throw new Error(`Google Sheet 資料讀取失敗：${res.status}`)

    const data = await res.json()
    gachaPools.value = data
      .filter((item) => item['卡池名稱'] || item.name)
      .map(normalizePool)
      .filter((pool) => pool.name && pool.startDate)

    if (yearOptions.value.length) {
      selectedYear.value = yearOptions.value[0]
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = '卡池資料讀取失敗，請確認 Google Sheet 是否公開，或 opensheet 網址是否正確。'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (carouselTimer) {
    window.clearInterval(carouselTimer)
  }
})

function startCarouselTimer() {
  if (carouselTimer) return

  carouselTimer = window.setInterval(() => {
    carouselIndex.value += 1
  }, 2800)
}

function getPoolImages(imageText) {
  return String(imageText || '')
    .split('|')
    .map((url) => url.trim())
    .filter(Boolean)
}

function getActiveCarouselIndex(imageText) {
  const images = getPoolImages(imageText)
  if (!images.length) return 0
  return carouselIndex.value % images.length
}

function getCarouselImage(pool) {
  const images = getPoolImages(pool.image)
  if (!images.length) return ''
  return images[getActiveCarouselIndex(pool.image)]
}

function normalizePool(item) {
  const name = readField(item, ['卡池名稱', 'name'])
  const year = readField(item, ['卡池年份', 'year'])
  const startDate = normalizeDate(readField(item, ['卡池起始日', 'startDate', 'start_date']))
  const endDate = normalizeDate(readField(item, ['結束日', '卡池結束日', 'endDate', 'end_date'])) || startDate
  const image = readField(item, ['卡池縮圖連結', '縮圖連結', 'image', 'thumbnail'])
  const characters = parseList(readField(item, ['角色', '登場角色', 'characters']))
  const note = readField(item, ['備註', 'note'])
  const isRerun = parseBoolean(readField(item, ['是否為復刻', '復刻', 'isRerun', 'rerun']))
  const poolTypeRaw = readField(item, ['卡池類型', 'type', 'poolType'])
  const poolTypeFromSheet = poolTypeRaw.toLowerCase()

  let poolType = 'single'

  if (poolTypeFromSheet.includes('免費') || poolTypeFromSheet.includes('free')) {
    poolType = 'free'
  } else if (poolTypeFromSheet.includes('daily') || poolTypeFromSheet.includes('日卡')) {
    poolType = 'daily'
  } else if (
    poolTypeFromSheet.includes('multi') ||
    poolTypeFromSheet.includes('多人') ||
    characters.length > 1
  ) {
    poolType = 'multi'
  }

  return {
    name,
    year,
    startDate,
    endDate,
    image,
    characters,
    note,
    isRerun,
    isFreeStar: poolType === 'free',
    poolType,
    typeLabel: getTypeLabel(poolType),
    hasOverlap: false,
  }
}

function readField(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
      return String(item[key]).trim()
    }
  }
  return ''
}

function normalizeDate(value) {
  if (!value) return ''

  const text = String(value).trim().replaceAll('/', '-')

  // 支援 Google Sheet / Excel 日期序號，例如 45377
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text)
    if (serial > 30000 && serial < 70000) {
      const utcDays = Math.floor(serial - 25569)
      const date = new Date(utcDays * 86400 * 1000)
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    }
  }

  const parts = text.split('-')

  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${year}-${pad(month)}-${pad(day)}`
  }

  return text
}

function parseList(value) {
  return String(value || '')
    .split(/[、，,\/／|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseBoolean(value) {
  const text = String(value || '').trim().toLowerCase()
  return ['true', 'yes', 'y', '1', '是', '有', '顯示', '復刻', '免費5星'].includes(text)
}

function getTypeLabel(poolType) {
  const labels = {
    single: '單人卡池',
    multi: '多人卡池',
    daily: '日卡池',
    free: '免費五星',
  }

  return labels[poolType] || '單人卡池'
}

function isInSelectedDateRange(pool) {
  if (!filterStartDate.value && !filterEndDate.value) return true

  const poolStart = toTime(pool.startDate)
  const poolEnd = toTime(pool.endDate || pool.startDate)
  const queryStart = filterStartDate.value ? toTime(filterStartDate.value) : -Infinity
  const queryEnd = filterEndDate.value ? toTime(filterEndDate.value) : Infinity

  if (!poolStart) return false
  return poolStart <= queryEnd && poolEnd >= queryStart
}

function getYearsCovered(startDate, endDate, fallbackYear) {
  const start = new Date(startDate)
  const end = new Date(endDate || startDate)
  const years = []

  if (Number.isNaN(start.getTime())) {
    const year = Number(fallbackYear)
    return year ? [year] : []
  }

  const startYear = start.getFullYear()
  const endYear = Number.isNaN(end.getTime()) ? startYear : end.getFullYear()

  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year)
  }

  return years
}

function isPoolActiveInYear(pool, year) {
  const selected = Number(year)
  if (!selected) return false

  const poolStart = toTime(pool.startDate)
  const poolEnd = toTime(pool.endDate || pool.startDate) || poolStart
  const yearStart = toTime(`${selected}-01-01`)
  const yearEnd = toTime(`${selected}-12-31`)

  if (!poolStart) return Number(pool.year) === selected
  return poolStart <= yearEnd && poolEnd >= yearStart
}

function getActiveMonths(startDate, endDate, year) {
  if (!startDate) return []

  const start = new Date(startDate)
  const end = new Date(endDate || startDate)
  const monthsSet = new Set()

  if (Number.isNaN(start.getTime())) return []

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const finalDate = Number.isNaN(end.getTime()) ? start : end

  while (cursor <= finalDate) {
    if (cursor.getFullYear() === Number(year)) {
      monthsSet.add(cursor.getMonth() + 1)
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return [...monthsSet]
}

function markOverlaps(pools) {
  return pools.map((pool, index) => {
    const hasOverlap = pools.some((other, otherIndex) => {
      if (index === otherIndex) return false
      return isOverlapping(pool, other)
    })

    return {
      ...pool,
      hasOverlap,
    }
  })
}

function isOverlapping(a, b) {
  const aStart = toTime(a.startDate)
  const aEnd = toTime(a.endDate || a.startDate)
  const bStart = toTime(b.startDate)
  const bEnd = toTime(b.endDate || b.startDate)

  if (!aStart || !bStart) return false
  return aStart <= bEnd && bStart <= aEnd
}

function comparePools(a, b) {
  const startDiff = toTime(a.startDate) - toTime(b.startDate)
  if (startDiff !== 0) return startDiff

  const endDiff = toTime(a.endDate || a.startDate) - toTime(b.endDate || b.startDate)
  if (endDiff !== 0) return endDiff

  return a.name.localeCompare(b.name, 'zh-Hant')
}

function resetFilters() {
  filterStartDate.value = ''
  filterEndDate.value = ''
  selectedType.value = 'all'
  selectedCharacter.value = 'all'
  showRerun.value = false
  hideFreeStar.value = false
}

function formatRange(startDate, endDate) {
  if (!startDate) return '日期未定'
  if (!endDate || startDate === endDate) return startDate
  return `${startDate} ~ ${endDate}`
}

function getDisplayDate(pool, month) {
  const year = Number(selectedYear.value)
  const start = new Date(pool.startDate)
  const end = new Date(pool.endDate || pool.startDate)

  if (Number.isNaN(start.getTime())) return pool.startDate || ''

  const startYear = start.getFullYear()
  const startMonth = start.getMonth() + 1
  const endYear = Number.isNaN(end.getTime()) ? startYear : end.getFullYear()
  const endMonth = Number.isNaN(end.getTime()) ? startMonth : end.getMonth() + 1

  // 在卡池開始的月份，顯示起始日
  if (startYear === year && startMonth === month) {
    return pool.startDate
  }

  // 跨月份或跨年度卡池，在結束月份顯示結束日
  if (endYear === year && endMonth === month) {
    return pool.endDate || pool.startDate
  }

  // 若卡池橫跨整個中間月份，顯示該月份 1 號，讓時間軸順序合理
  return `${year}-${pad(month)}-01`
}

function comparePoolsByDisplayDate(a, b, month) {
  const displayDiff = toTime(getDisplayDate(a, month)) - toTime(getDisplayDate(b, month))
  if (displayDiff !== 0) return displayDiff

  return comparePools(a, b)
}

function groupPoolsByDisplayDate(pools, month) {
  const groups = new Map()

  pools.forEach((pool) => {
    const displayDate = getDisplayDate(pool, month)
    if (!groups.has(displayDate)) {
      groups.set(displayDate, {
        displayDate,
        day: displayDate ? displayDate.slice(8, 10) : '--',
        monthDay: displayDate ? displayDate.slice(5, 10) : '',
        pools: [],
      })
    }

    groups.get(displayDate).pools.push(pool)
  })

  return [...groups.values()].sort((a, b) => toTime(a.displayDate) - toTime(b.displayDate))
}

function toTime(date) {
  const time = new Date(date).getTime()
  return Number.isNaN(time) ? 0 : time
}

function pad(value) {
  return String(value).padStart(2, '0')
}
</script>

<style scoped>
.calendar-hero,
.filter-panel,
.calendar-summary,
.month-panel {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 34px rgba(31, 41, 55, 0.07);
}

.calendar-hero {
  display: flex;
  justify-content: space-between;
  gap: 22px;
  align-items: flex-end;
  padding: 24px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 8px;
  color: rgba(99, 102, 241, 0.86);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.calendar-hero h1 {
  margin: 0;
  color: rgba(17, 24, 39, 0.92);
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.18;
}

.calendar-desc {
  max-width: 720px;
  margin: 10px 0 0;
  color: rgba(75, 85, 99, 0.9);
  line-height: 1.75;
}

.year-picker,
.filter-field {
  display: grid;
  gap: 8px;
  color: rgba(75, 85, 99, 0.9);
  font-size: 13px;
  font-weight: 900;
}

.year-picker {
  min-width: 160px;
}

.year-picker select,
.filter-field select,
.filter-field input {
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.95);
  color: rgba(17, 24, 39, 0.9);
  font-weight: 800;
  outline: none;
}

.year-picker select:focus,
.filter-field select:focus,
.filter-field input:focus {
  border-color: rgba(184, 217, 255, 1);
  box-shadow: 0 0 0 4px rgba(184, 217, 255, 0.28);
}

.filter-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 14px;
  align-items: end;
  padding: 16px;
  margin-bottom: 16px;
}

.rerun-check {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  color: rgba(75, 85, 99, 0.92);
  font-size: 13px;
  font-weight: 900;
}

.rerun-check input {
  width: 16px;
  height: 16px;
  accent-color: #a5b4fc;
}

.clear-filter-btn {
  border: 0;
  border-radius: 999px;
  padding: 11px 16px;
  background: rgba(243, 244, 246, 0.96);
  color: rgba(75, 85, 99, 0.94);
  font-weight: 900;
  cursor: pointer;
}

.clear-filter-btn:hover {
  background: rgba(229, 231, 235, 1);
}

.calendar-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.summary-card {
  border-radius: 16px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(246, 199, 216, 0.24), rgba(184, 217, 255, 0.26));
}

.summary-card span {
  display: block;
  margin-bottom: 6px;
  color: rgba(75, 85, 99, 0.88);
  font-size: 12px;
  font-weight: 900;
}

.summary-card strong {
  color: rgba(17, 24, 39, 0.92);
  font-size: 24px;
}

.month-panel {
  padding: 18px;
  margin-bottom: 16px;
}

.month-title-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.month-index {
  margin: 0 0 4px;
  color: rgba(99, 102, 241, 0.74);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.month-title-row h2 {
  margin: 0;
  color: rgba(17, 24, 39, 0.92);
  font-size: 21px;
}

.month-count {
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(243, 244, 246, 0.9);
  color: rgba(75, 85, 99, 0.86);
  font-size: 12px;
  font-weight: 900;
}

.timeline-list {
  position: relative;
  display: grid;
  gap: 10px;
}

.timeline-list::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 31px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(184, 217, 255, 0.85), rgba(246, 199, 216, 0.65));
}

.timeline-day-group {
  position: relative;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
}

.timeline-day-pools {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.pool-card {
  position: relative;
  display: block;
  overflow: hidden;
}

.pool-card.overlapping .pool-main {
  border-color: rgba(244, 114, 182, 0.5);
  box-shadow: 0 10px 24px rgba(244, 114, 182, 0.08);
}

.pool-card.rerun .pool-main {
  background: rgba(255, 251, 235, 0.88);
}

.pool-card.free-star .pool-main {
  background: rgba(250, 245, 255, 0.9);
}

.date-rail {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  align-self: start;
  min-height: 60px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 10px 20px rgba(31, 41, 55, 0.05);
}

.date-rail strong {
  color: rgba(17, 24, 39, 0.9);
  font-size: 19px;
  line-height: 1;
}

.date-rail span {
  color: rgba(107, 114, 128, 0.86);
  font-size: 10px;
  font-weight: 900;
}

.pool-main {
  display: grid;
  grid-template-columns: minmax(110px, 148px) minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 22px rgba(31, 41, 55, 0.06);
}

.pool-thumb-area,
.pool-thumb-placeholder {
  position: relative;
  min-height: 108px;
  overflow: hidden;
  background: rgba(243, 244, 246, 0.9);
}

.pool-thumb {
  width: 100%;
  height: 100%;
  min-height: 108px;
  display: block;
  object-fit: cover;
  background: rgba(229, 231, 235, 0.9);
}

.carousel-dots {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
}

.carousel-dots span {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.55);
}

.carousel-dots span.active {
  width: 12px;
  background: rgba(99, 102, 241, 0.85);
}

.pool-thumb-placeholder {
  display: grid;
  place-items: center;
  color: rgba(107, 114, 128, 0.84);
  font-weight: 900;
  font-size: 13px;
}

.pool-card-body {
  display: flex;
  min-height: 108px;
  flex-direction: column;
  padding: 12px;
}

.pool-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  color: rgba(107, 114, 128, 0.9);
  font-size: 11px;
  font-weight: 800;
}

.range-text {
  margin-left: auto;
}

.pool-type,
.overlap-badge,
.rerun-badge,
.free-star-badge {
  border-radius: 999px;
  padding: 2px 7px;
}

.pool-type {
  background: rgba(184, 217, 255, 0.35);
  color: rgba(30, 64, 175, 0.82);
}

.pool-type.multi {
  background: rgba(246, 199, 216, 0.35);
  color: rgba(157, 23, 77, 0.78);
}

.pool-type.daily {
  background: rgba(221, 214, 254, 0.46);
  color: rgba(91, 33, 182, 0.82);
}

.pool-type.free {
  background: rgba(254, 240, 138, 0.42);
  color: rgba(133, 77, 14, 0.9);
}

.overlap-badge {
  background: rgba(254, 243, 199, 0.88);
  color: rgba(146, 64, 14, 0.9);
}

.rerun-badge {
  background: rgba(220, 252, 231, 0.92);
  color: rgba(22, 101, 52, 0.9);
}

.free-star-badge {
  background: rgba(254, 240, 138, 0.58);
  color: rgba(133, 77, 14, 0.95);
}

.pool-card h3 {
  margin: 0 0 7px;
  color: rgba(17, 24, 39, 0.92);
  font-size: 16px;
  line-height: 1.35;
}

.character-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 7px;
}

.character-list span {
  border-radius: 999px;
  padding: 3px 7px;
  background: rgba(246, 199, 216, 0.24);
  color: rgba(75, 85, 99, 0.92);
  font-size: 11px;
  font-weight: 800;
}

.pool-note {
  margin: 0;
  color: rgba(75, 85, 99, 0.88);
  font-size: 13px;
  line-height: 1.45;
}

.empty-state,
.empty-month {
  border: 1px dashed rgba(209, 213, 219, 0.95);
  border-radius: 18px;
  padding: 22px;
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

@media (max-width: 1100px) {
  .filter-panel {
    grid-template-columns: 1fr 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .filter-panel {
    grid-template-columns: 1fr 1fr;
  }

  .clear-filter-btn {
    grid-column: 1 / -1;
  }

  .pool-main {
    grid-template-columns: minmax(96px, 128px) minmax(0, 1fr);
  }

  .pool-thumb-area,
  .pool-thumb-placeholder,
  .pool-thumb {
    min-height: 96px;
  }

  .pool-card-body {
    min-height: 96px;
  }
}

@media (max-width: 760px) {
  .calendar-hero {
    display: grid;
    align-items: stretch;
    padding: 18px;
  }

  .calendar-desc {
    font-size: 13px;
    line-height: 1.65;
  }

  .filter-panel,
  .calendar-summary {
    grid-template-columns: 1fr;
  }

  .calendar-summary {
    display: none;
  }

  .month-panel {
    padding: 14px;
    border-radius: 20px;
  }

  .month-title-row {
    align-items: center;
    margin-bottom: 12px;
  }

  .month-title-row h2 {
    font-size: 19px;
  }

  .month-count {
    padding: 5px 9px;
    font-size: 11px;
  }

  .timeline-list {
    gap: 8px;
    padding-left: 4px;
  }

  .timeline-list::before {
    display: block;
    left: 21px;
    top: 6px;
    bottom: 6px;
  }

  .timeline-day-group {
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }

  .timeline-day-pools {
    gap: 8px;
  }

  .pool-card {
    display: block;
  }

  .date-rail {
    width: 42px;
    min-height: 42px;
    border-radius: 50%;
    padding: 0;
  }

  .date-rail strong {
    font-size: 15px;
  }

  .date-rail span {
    display: none;
  }

  .pool-main {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    align-items: center;
    border-radius: 14px;
    min-height: 62px;
    box-shadow: 0 8px 18px rgba(31, 41, 55, 0.05);
  }

  .pool-thumb-area,
  .pool-thumb-placeholder,
  .pool-thumb {
    min-height: 62px;
    height: 62px;
  }

  .pool-thumb-placeholder {
    font-size: 10px;
  }

  .carousel-dots {
    right: 5px;
    bottom: 5px;
    gap: 3px;
    padding: 3px 5px;
  }

  .carousel-dots span {
    width: 4px;
    height: 4px;
  }

  .carousel-dots span.active {
    width: 9px;
  }

  .pool-card-body {
    min-height: auto;
    padding: 8px 10px;
  }

  .pool-meta {
    margin: 0 0 4px;
    gap: 0;
    font-size: 11px;
  }

  .pool-type,
  .overlap-badge,
  .rerun-badge,
  .free-star-badge,
  .character-list,
  .pool-note {
    display: none !important;
  }

  .range-text {
    margin-left: 0;
    color: rgba(107, 114, 128, 0.88);
    font-size: 11px;
  }

  .pool-card h3 {
  margin: 0;
  font-size: 13px;
  line-height: 1.35;

  overflow: hidden;
  text-overflow: ellipsis;

  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
}

  .empty-month {
    padding: 16px;
    font-size: 13px;
  }
}
</style>
