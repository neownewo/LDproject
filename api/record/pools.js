import { onlyMethods } from '../../lib/record/http.js'
import { requireUser } from '../../lib/record/auth.js'
import { getRecordPools } from '../../lib/record/pools.js'

export default async function handler(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  if (!requireUser(req, res)) return

  try {
    const pools = await getRecordPools()
    res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(pools)
  } catch (error) {
    console.error('record pools failed', error)
    return res.status(500).json({ error: 'POOLS_FAILED', message: '卡池資料讀取失敗。' })
  }
}
