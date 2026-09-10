import { requireAdmin } from '../_lib/auth.js'
import { getJsonBody, onlyMethods } from '../_lib/http.js'
import { createGachaPool, listGachaPools } from '../_lib/supabase.js'

const ALLOWED_TYPES = new Set(['single', 'multi', 'daily', 'free'])

function cleanPayload(body) {
  const name = String(body.name || '').trim()
  const poolType = String(body.pool_type || '').trim()
  const startDate = String(body.start_date || '').trim()
  const endDate = String(body.end_date || startDate).trim()
  if (!name || !startDate || !endDate || !ALLOWED_TYPES.has(poolType)) {
    throw new Error('INVALID_GACHA_DATA')
  }

  return {
    name,
    pool_type: poolType,
    characters: Array.isArray(body.characters) ? body.characters.map(String).map((v) => v.trim()).filter(Boolean) : [],
    start_date: startDate,
    end_date: endDate,
    is_rerun: Boolean(body.is_rerun),
    note: String(body.note || '').trim(),
    image_urls: Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : [],
    image_paths: Array.isArray(body.image_paths) ? body.image_paths.filter(Boolean) : [],
    is_published: Boolean(body.is_published),
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
  }
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['GET', 'POST'])) return

  try {
    if (req.method === 'GET') {
      return res.status(200).json((await listGachaPools()) || [])
    }

    const rows = await createGachaPool(cleanPayload(getJsonBody(req)))
    res.status(201).json(rows?.[0] || null)
  } catch (error) {
    console.error(error)
    const status = error.message === 'INVALID_GACHA_DATA' ? 400 : 500
    res.status(status).json({ error: error.message || 'GACHA_WRITE_FAILED' })
  }
}
