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
          <option v-for="type in poolTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
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
          <strong>{{ poolCounts.single }}</strong>
        </div>
        <div class="summary-card">
          <span>多人卡池</span>
          <strong>{{ poolCounts.multi }}</strong>
        </div>
        <div class="summary-card">
          <span>日卡池</span>
          <strong>{{ poolCounts.daily }}</strong>
        </div>
        <div class="summary-card">
          <span>免費五星</span>
          <strong>{{ poolCounts.free }}</strong>
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
                :class="['pool-card', { overlapping: pool.hasOverlap, rerun: pool.isRerun, 'free-star': pool.poolType === 'free' }]"
              >
                <div class="pool-main">
                  <div class="pool-thumb-area">
                    <template v-if="pool.images.length">
                      <img
                        class="pool-thumb"
                        :src="getCarouselImage(pool)"
                        :alt="`${pool.name} 縮圖`"
                        loading="lazy"
                      />

                      <div v-if="pool.images.length > 1" class="carousel-dots">
                        <span
                          v-for="(_, index) in pool.images"
                          :key="index"
                          :class="{ active: index === getActiveCarouselIndex(pool) }"
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppLayout from './AppLayout.vue'
import { MONTHS, POOL_TYPES } from '../constants/gacha'
import { fetchGachaPools } from '../services/gachaService'
import {
  comparePools,
  formatRange,
  getActiveMonths,
  getDisplayDate,
  getYearsCovered,
  groupPoolsByDisplayDate,
  isOverlapping,
  isPoolActiveInYear,
  pad,
  toTime,
} from '../utils/gachaDate'

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

const months = MONTHS
const poolTypes = POOL_TYPES

const yearOptions = computed(() => {
  const years = gachaPools.value.flatMap((pool) =>
    getYearsCovered(pool.startDate, pool.endDate, pool.legacyYear),
  )
  const currentYear = new Date().getFullYear()
  return [...new Set([...years, currentYear])].sort((a, b) => b - a)
})

const yearlyPools = computed(() =>
  gachaPools.value
    .filter((pool) => isPoolActiveInYear(pool, selectedYear.value))
    .sort(comparePools),
)

const characterOptions = computed(() => {
  const characters = yearlyPools.value.flatMap((pool) => pool.characters)
  return [...new Set(characters)].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
})

const filteredPools = computed(() => yearlyPools.value.filter((pool) => {
  const matchType = selectedType.value === 'all' || pool.poolType === selectedType.value
  const matchCharacter = selectedCharacter.value === 'all' || pool.characters.includes(selectedCharacter.value)
  const matchRerun = showRerun.value || !pool.isRerun
  const matchFreeStar = !hideFreeStar.value || pool.poolType !== 'free'
  return matchType && matchCharacter && isInSelectedDateRange(pool) && matchRerun && matchFreeStar
}))

const poolCounts = computed(() => filteredPools.value.reduce(
  (counts, pool) => {
    if (counts[pool.poolType] !== undefined) counts[pool.poolType] += 1
    return counts
  },
  { single: 0, multi: 0, daily: 0, free: 0 },
))

const poolsByMonth = computed(() => {
  const result = Object.fromEntries(months.map(({ value }) => [value, []]))

  filteredPools.value.forEach((pool) => {
    getActiveMonths(pool.startDate, pool.endDate, selectedYear.value).forEach((month) => {
      result[month]?.push(pool)
    })
  })

  Object.keys(result).forEach((monthKey) => {
    const month = Number(monthKey)
    const sorted = result[month].sort((a, b) => comparePoolsByDisplayDate(a, b, month))
    result[month] = groupPoolsByDisplayDate(markOverlaps(sorted), month, selectedYear.value)
  })

  return result
})

onMounted(async () => {
  startCarouselTimer()
  try {
    loading.value = true
    errorMessage.value = ''
    gachaPools.value = await fetchGachaPools()
    if (yearOptions.value.length) selectedYear.value = yearOptions.value[0]
  } catch (error) {
    console.error(error)
    errorMessage.value = '卡池資料讀取失敗，請確認 Google Sheet 是否公開，或 opensheet 網址是否正確。'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (carouselTimer) window.clearInterval(carouselTimer)
})

function startCarouselTimer() {
  if (carouselTimer) return
  carouselTimer = window.setInterval(() => { carouselIndex.value += 1 }, 2800)
}

function getActiveCarouselIndex(pool) {
  return pool.images.length ? carouselIndex.value % pool.images.length : 0
}

function getCarouselImage(pool) {
  return pool.images[getActiveCarouselIndex(pool)] || ''
}

function isInSelectedDateRange(pool) {
  if (!filterStartDate.value && !filterEndDate.value) return true
  const poolStart = toTime(pool.startDate)
  const poolEnd = toTime(pool.endDate || pool.startDate)
  const queryStart = filterStartDate.value ? toTime(filterStartDate.value) : -Infinity
  const queryEnd = filterEndDate.value ? toTime(filterEndDate.value) : Infinity
  if (poolStart === null) return false
  return poolStart <= queryEnd && poolEnd >= queryStart
}

function markOverlaps(pools) {
  return pools.map((pool, index) => ({
    ...pool,
    hasOverlap: pools.some((other, otherIndex) => index !== otherIndex && isOverlapping(pool, other)),
  }))
}

function comparePoolsByDisplayDate(a, b, month) {
  const aDate = getDisplayDate(a, month, selectedYear.value)
  const bDate = getDisplayDate(b, month, selectedYear.value)
  const displayDiff = (toTime(aDate) ?? 0) - (toTime(bDate) ?? 0)
  return displayDiff || comparePools(a, b)
}

function getMonthPoolCount(monthValue) {
  return (poolsByMonth.value[monthValue] || []).reduce((sum, group) => sum + group.pools.length, 0)
}

function resetFilters() {
  filterStartDate.value = ''
  filterEndDate.value = ''
  selectedType.value = 'all'
  selectedCharacter.value = 'all'
  showRerun.value = false
  hideFreeStar.value = false
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
