export const MONTHS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
].map((label, index) => ({ value: index + 1, label }))

export const POOL_TYPES = [
  { value: 'single', label: '單人卡池' },
  { value: 'multi', label: '多人卡池' },
  { value: 'daily', label: '日卡池' },
  { value: 'free', label: '免費五星' },
]

export const POOL_TYPE_LABELS = Object.fromEntries(
  POOL_TYPES.map(({ value, label }) => [value, label]),
)
