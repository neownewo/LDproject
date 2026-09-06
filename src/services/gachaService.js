import { SITE } from '../site.config'
import { POOL_TYPE_LABELS } from '../constants/gacha'
import { normalizeDate } from '../utils/gachaDate'
import { fetchSheetRows } from './sheetService'

function readField(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
      return String(item[key]).trim()
    }
  }
  return ''
}

function parseList(value, separator = /[、，,\/／|]/) {
  return String(value || '').split(separator).map((item) => item.trim()).filter(Boolean)
}

function parseBoolean(value) {
  const text = String(value || '').trim().toLowerCase()
  return ['true', 'yes', 'y', '1', '是', '有', '顯示', '復刻', '免費5星'].includes(text)
}

function resolvePoolType(rawType, characters) {
  const type = String(rawType || '').toLowerCase()
  if (type.includes('免費') || type.includes('free')) return 'free'
  if (type.includes('daily') || type.includes('日卡')) return 'daily'
  if (type.includes('multi') || type.includes('多人') || characters.length > 1) return 'multi'
  return 'single'
}

export function normalizeLegacyPool(item, index = 0) {
  const name = readField(item, ['卡池名稱', 'name'])
  const legacyYear = readField(item, ['卡池年份', 'year'])
  const startDate = normalizeDate(readField(item, ['卡池起始日', 'startDate', 'start_date']))
  const endDate = normalizeDate(readField(item, ['結束日', '卡池結束日', 'endDate', 'end_date'])) || startDate
  const characters = parseList(readField(item, ['角色', '登場角色', 'characters']))
  const poolType = resolvePoolType(readField(item, ['卡池類型', 'type', 'poolType']), characters)

  return {
    id: `legacy-${index}-${name}-${startDate}`,
    source: 'legacy',
    name,
    legacyYear,
    startDate,
    endDate,
    images: parseList(readField(item, ['卡池縮圖連結', '縮圖連結', 'image', 'thumbnail']), '|'),
    characters,
    note: readField(item, ['備註', 'note']),
    isRerun: parseBoolean(readField(item, ['是否為復刻', '復刻', 'isRerun', 'rerun'])),
    poolType,
    typeLabel: POOL_TYPE_LABELS[poolType] || POOL_TYPE_LABELS.single,
    hasOverlap: false,
  }
}

export function normalizeSupabasePool(item) {
  const poolType = resolvePoolType(item.pool_type, item.characters || [])
  return {
    id: item.id,
    source: 'supabase',
    name: String(item.name || '').trim(),
    legacyYear: '',
    startDate: normalizeDate(item.start_date),
    endDate: normalizeDate(item.end_date) || normalizeDate(item.start_date),
    images: Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : [],
    characters: Array.isArray(item.characters) ? item.characters.filter(Boolean) : [],
    note: String(item.note || '').trim(),
    isRerun: Boolean(item.is_rerun),
    poolType,
    typeLabel: POOL_TYPE_LABELS[poolType] || POOL_TYPE_LABELS.single,
    hasOverlap: false,
  }
}

async function fetchLegacyPools() {
  const rows = await fetchSheetRows(SITE.sheets.gacha)
  return rows
    .filter((item) => item['卡池名稱'] || item.name)
    .map(normalizeLegacyPool)
    .filter((pool) => pool.name && pool.startDate)
}

async function fetchManagedPools() {
  const response = await fetch('/api/gacha')
  if (!response.ok) throw new Error(`Managed gacha API failed: ${response.status}`)
  const rows = await response.json()
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeSupabasePool)
    .filter((pool) => pool.name && pool.startDate)
}

export async function fetchGachaPools() {
  const [legacyResult, managedResult] = await Promise.allSettled([
    fetchLegacyPools(),
    fetchManagedPools(),
  ])

  const legacyPools = legacyResult.status === 'fulfilled' ? legacyResult.value : []
  const managedPools = managedResult.status === 'fulfilled' ? managedResult.value : []

  if (legacyResult.status === 'rejected') console.warn('Legacy gacha source failed:', legacyResult.reason)
  if (managedResult.status === 'rejected') console.warn('Managed gacha source failed:', managedResult.reason)

  if (!legacyPools.length && !managedPools.length && legacyResult.status === 'rejected' && managedResult.status === 'rejected') {
    throw new Error('所有卡池資料來源都讀取失敗')
  }

  return [...legacyPools, ...managedPools]
}
