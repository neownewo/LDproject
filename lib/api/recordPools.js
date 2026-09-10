import crypto from 'node:crypto'
import { listPublishedGachaPools } from './supabase.js'

const DEFAULT_GACHA_SHEET_URL = 'https://opensheet.elk.sh/1XWvnyr8B36KSfqCNp3rKbQzztVEMB5fEb2869eo4CeU/卡池月曆'

function readField(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
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

function normalizeDate(value) {
  if (!value) return ''
  const raw = String(value).trim().replace(/[.\/]/g, '-')
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return ''
  const [, y, m, d] = match
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function resolvePoolType(rawType, characters) {
  const type = String(rawType || '').toLowerCase()
  if (type.includes('免費') || type.includes('free')) return 'free'
  if (type.includes('daily') || type.includes('日卡')) return 'daily'
  if (type.includes('multi') || type.includes('多人') || characters.length > 1) return 'multi'
  return 'single'
}

function legacyKey({ name, startDate, endDate, characters, poolType }) {
  const signature = [name, startDate, endDate, [...characters].sort().join(','), poolType].join('|')
  const hash = crypto.createHash('sha256').update(signature).digest('hex').slice(0, 24)
  return `legacy:${hash}`
}

function normalizeLegacyPool(item) {
  const name = readField(item, ['卡池名稱', 'name'])
  const startDate = normalizeDate(readField(item, ['卡池起始日', 'startDate', 'start_date']))
  const endDate = normalizeDate(readField(item, ['結束日', '卡池結束日', 'endDate', 'end_date'])) || startDate
  const characters = parseList(readField(item, ['角色', '登場角色', 'characters']))
  const poolType = resolvePoolType(readField(item, ['卡池類型', 'type', 'poolType']), characters)
  const pool = {
    source: 'legacy',
    name,
    startDate,
    endDate,
    images: parseList(readField(item, ['卡池縮圖連結', '縮圖連結', 'image', 'thumbnail']), '|'),
    characters,
    note: readField(item, ['備註', 'note']),
    isRerun: parseBoolean(readField(item, ['是否為復刻', '復刻', 'isRerun', 'rerun'])),
    poolType,
  }
  return { ...pool, poolKey: legacyKey(pool) }
}

function normalizeManagedPool(item) {
  return {
    poolKey: `supabase:${item.id}`,
    source: 'supabase',
    name: String(item.name || '').trim(),
    startDate: normalizeDate(item.start_date),
    endDate: normalizeDate(item.end_date) || normalizeDate(item.start_date),
    images: Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : [],
    characters: Array.isArray(item.characters) ? item.characters.filter(Boolean) : [],
    note: String(item.note || '').trim(),
    isRerun: Boolean(item.is_rerun),
    poolType: resolvePoolType(item.pool_type, item.characters || []),
  }
}

async function getLegacyPools() {
  const url = process.env.RECORD_GACHA_SHEET_URL || DEFAULT_GACHA_SHEET_URL
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Legacy sheet failed: ${response.status}`)
  const rows = await response.json()
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeLegacyPool)
    .filter((pool) => pool.name && pool.startDate && pool.poolType !== 'free' && !pool.isRerun)
}

async function getManagedPools() {
  const rows = await listPublishedGachaPools()
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeManagedPool)
    .filter((pool) => pool.name && pool.startDate && pool.poolType !== 'free' && !pool.isRerun)
}

function buildPoolCards(pool) {
  const images = Array.isArray(pool.images) ? pool.images.filter(Boolean) : []
  const characters = Array.isArray(pool.characters) ? pool.characters.filter(Boolean) : []
  let count = 1
  if (pool.poolType === 'daily') count = Math.max(2, images.length)
  else if (pool.poolType === 'multi') count = images.length || characters.length || 1

  return Array.from({ length: count }, (_, index) => ({
    cardKey: `card:${index}`,
    cardIndex: index,
    label: pool.poolType === 'daily'
      ? `${characters[0] || '日卡'} · ${index + 1}`
      : (characters[index] || `卡片 ${index + 1}`),
    imageUrl: images[index] || '',
  }))
}

export async function getRecordPools() {
  const [legacy, managed] = await Promise.allSettled([getLegacyPools(), getManagedPools()])
  const legacyPools = legacy.status === 'fulfilled' ? legacy.value : []
  const managedPools = managed.status === 'fulfilled' ? managed.value : []

  if (legacy.status === 'rejected') console.warn('Record legacy pools failed:', legacy.reason)
  if (managed.status === 'rejected') console.warn('Record managed pools failed:', managed.reason)

  if (!legacyPools.length && !managedPools.length && legacy.status === 'rejected' && managed.status === 'rejected') {
    throw new Error('All pool sources failed')
  }

  const byKey = new Map()
  for (const pool of [...legacyPools, ...managedPools]) byKey.set(pool.poolKey, pool)
  return [...byKey.values()]
    .map((pool) => ({ ...pool, cards: buildPoolCards(pool) }))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))
}
