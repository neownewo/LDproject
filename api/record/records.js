import { onlyMethods, getJsonBody, sendError } from '../../lib/record/http.js'
import { requireUser } from '../../lib/record/auth.js'
import { listRecords, upsertRecord, deleteRecord } from '../../lib/record/supabase.js'

function validatePoolKey(value) {
  return /^(legacy:[a-f0-9]{24}|supabase:[0-9a-fA-F-]{20,})$/.test(String(value || ''))
}

function parseInteger(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

export default async function handler(req, res) {
  if (!onlyMethods(req, res, ['GET', 'PUT', 'DELETE'])) return
  const session = requireUser(req, res)
  if (!session) return

  try {
    if (req.method === 'GET') {
      const rows = await listRecords(session.userId)
      return res.status(200).json(Array.isArray(rows) ? rows : [])
    }

    const body = getJsonBody(req)
    const poolKey = String(body.poolKey || '').trim()
    if (!validatePoolKey(poolKey)) return sendError(res, 400, 'INVALID_POOL', '卡池識別碼不正確。')

    if (req.method === 'DELETE') {
      await deleteRecord(session.userId, poolKey)
      return res.status(200).json({ ok: true })
    }

    const rank = parseInteger(body.rank)
    const pullCount = parseInteger(body.pullCount)
    const amountTwd = parseInteger(body.amountTwd)

    if (rank === null || rank < 0 || rank > 3) return sendError(res, 400, 'INVALID_RANK', '疊卡層級不正確。')
    if (pullCount === null || pullCount < 0 || pullCount > 1000000) return sendError(res, 400, 'INVALID_PULL_COUNT', '抽數不正確。')
    if (amountTwd === null || amountTwd < 0 || amountTwd > 100000000) return sendError(res, 400, 'INVALID_AMOUNT', '課金金額不正確。')

    const saved = await upsertRecord(session.userId, { poolKey, rank, pullCount, amountTwd })
    return res.status(200).json(saved || { pool_key: poolKey, rank, pull_count: pullCount, amount_twd: amountTwd })
  } catch (error) {
    console.error('record records failed', error)
    return sendError(res, 500, 'RECORD_FAILED', '紀錄儲存失敗，請稍後再試。')
  }
}
