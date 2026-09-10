import { requireAdmin } from '../../_lib/auth.js'
import { getJsonBody, onlyMethods } from '../../_lib/http.js'
import { dbRequest, deleteGachaPool, deleteImages, updateGachaPool } from '../../_lib/supabase.js'

const ALLOWED_TYPES = new Set(['single', 'multi', 'daily', 'free'])

function cleanPayload(body) {
  const payload = {}
  const fields = ['name', 'start_date', 'end_date', 'note']
  for (const field of fields) if (field in body) payload[field] = String(body[field] || '').trim()
  if ('pool_type' in body) {
    const type = String(body.pool_type || '').trim()
    if (!ALLOWED_TYPES.has(type)) throw new Error('INVALID_GACHA_DATA')
    payload.pool_type = type
  }
  if ('characters' in body) payload.characters = Array.isArray(body.characters) ? body.characters.map(String).map((v) => v.trim()).filter(Boolean) : []
  if ('image_urls' in body) payload.image_urls = Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : []
  if ('image_paths' in body) payload.image_paths = Array.isArray(body.image_paths) ? body.image_paths.filter(Boolean) : []
  if ('is_rerun' in body) payload.is_rerun = Boolean(body.is_rerun)
  if ('is_published' in body) payload.is_published = Boolean(body.is_published)
  if ('sort_order' in body) payload.sort_order = Number(body.sort_order) || 0
  return payload
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['PATCH', 'DELETE'])) return
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'MISSING_ID' })

  try {
    if (req.method === 'PATCH') {
      const current = await dbRequest(`gacha_pools?id=eq.${encodeURIComponent(id)}&select=image_paths`)
      const oldPaths = current?.[0]?.image_paths || []
      const payload = cleanPayload(getJsonBody(req))
      const rows = await updateGachaPool(id, payload)
      if (payload.image_paths) {
        const removed = oldPaths.filter((path) => !payload.image_paths.includes(path))
        await deleteImages(removed)
      }
      return res.status(200).json(rows?.[0] || null)
    }

    const rows = await deleteGachaPool(id)
    const deleted = rows?.[0] || null
    if (deleted?.image_paths?.length) await deleteImages(deleted.image_paths)
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message || 'GACHA_WRITE_FAILED' })
  }
}
