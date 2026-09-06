export function pad(value) {
  return String(value).padStart(2, '0')
}

export function normalizeDate(value) {
  if (!value) return ''
  const text = String(value).trim().replaceAll('/', '-')

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

export function toTime(date) {
  if (!date) return null
  const time = new Date(date).getTime()
  return Number.isNaN(time) ? null : time
}

export function getYearsCovered(startDate, endDate, fallbackYear) {
  const start = new Date(startDate)
  const end = new Date(endDate || startDate)
  if (Number.isNaN(start.getTime())) {
    const year = Number(fallbackYear)
    return year ? [year] : []
  }

  const years = []
  const startYear = start.getFullYear()
  const endYear = Number.isNaN(end.getTime()) ? startYear : end.getFullYear()
  for (let year = startYear; year <= endYear; year += 1) years.push(year)
  return years
}

export function isPoolActiveInYear(pool, year) {
  const selected = Number(year)
  if (!selected) return false
  const poolStart = toTime(pool.startDate)
  const poolEnd = toTime(pool.endDate || pool.startDate) ?? poolStart
  const yearStart = toTime(`${selected}-01-01`)
  const yearEnd = toTime(`${selected}-12-31`)
  if (poolStart === null) return Number(pool.legacyYear) === selected
  return poolStart <= yearEnd && poolEnd >= yearStart
}

export function getActiveMonths(startDate, endDate, year) {
  if (!startDate) return []
  const start = new Date(startDate)
  const end = new Date(endDate || startDate)
  if (Number.isNaN(start.getTime())) return []

  const months = new Set()
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const finalDate = Number.isNaN(end.getTime()) ? start : end
  while (cursor <= finalDate) {
    if (cursor.getFullYear() === Number(year)) months.add(cursor.getMonth() + 1)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return [...months]
}

export function isOverlapping(a, b) {
  const aStart = toTime(a.startDate)
  const aEnd = toTime(a.endDate || a.startDate)
  const bStart = toTime(b.startDate)
  const bEnd = toTime(b.endDate || b.startDate)
  if (aStart === null || bStart === null) return false
  return aStart <= bEnd && bStart <= aEnd
}

export function comparePools(a, b) {
  const startDiff = (toTime(a.startDate) ?? 0) - (toTime(b.startDate) ?? 0)
  if (startDiff !== 0) return startDiff
  const endDiff = (toTime(a.endDate || a.startDate) ?? 0) - (toTime(b.endDate || b.startDate) ?? 0)
  if (endDiff !== 0) return endDiff
  return a.name.localeCompare(b.name, 'zh-Hant')
}

export function formatRange(startDate, endDate) {
  if (!startDate) return '日期未定'
  if (!endDate || startDate === endDate) return startDate
  return `${startDate} ~ ${endDate}`
}

export function getDisplayDate(pool, month, year) {
  const start = new Date(pool.startDate)
  const end = new Date(pool.endDate || pool.startDate)
  if (Number.isNaN(start.getTime())) return pool.startDate || ''

  const startYear = start.getFullYear()
  const startMonth = start.getMonth() + 1
  const endYear = Number.isNaN(end.getTime()) ? startYear : end.getFullYear()
  const endMonth = Number.isNaN(end.getTime()) ? startMonth : end.getMonth() + 1

  if (startYear === Number(year) && startMonth === month) return pool.startDate
  if (endYear === Number(year) && endMonth === month) return pool.endDate || pool.startDate
  return `${year}-${pad(month)}-01`
}

export function groupPoolsByDisplayDate(pools, month, year) {
  const groups = new Map()
  pools.forEach((pool) => {
    const displayDate = getDisplayDate(pool, month, year)
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
  return [...groups.values()].sort((a, b) => (toTime(a.displayDate) ?? 0) - (toTime(b.displayDate) ?? 0))
}
