import crypto from 'node:crypto'
import { getJsonBody, onlyMethods } from '../../lib/api/http.js'
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  isAdminAuthenticated,
  requireAdmin,
  verifyAdminPassword,
} from '../../lib/api/neiwneiwAuth.js'
import {
  createGachaPool,
  dbRequest,
  deleteGachaPool,
  deleteImages,
  listGachaPools,
  updateGachaPool,
  uploadImage,
} from '../../lib/api/supabase.js'

const ALLOWED_TYPES = new Set(['single', 'multi', 'daily', 'free'])
const MAX_BYTES = 2 * 1024 * 1024

function routeParts(req) {
  const raw = req.query?.path
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (raw !== undefined && raw !== null && String(raw)) return [String(raw)]

  // 本機或不同 adapter 下的備援解析。
  const pathname = String(req.url || '').split('?')[0]
  return pathname.replace(/^\/api\/neiwneiw\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

function cleanCreatePayload(body) {
  const name = String(body.name || '').trim()
  const poolType = String(body.pool_type || '').trim()
  const startDate = String(body.start_date || '').trim()
  const endDate = String(body.end_date || startDate).trim()
  if (!name || !startDate || !endDate || !ALLOWED_TYPES.has(poolType)) throw new Error('INVALID_GACHA_DATA')

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

function cleanUpdatePayload(body) {
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

async function handleLogin(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  const { password = '' } = getJsonBody(req)
  if (!verifyAdminPassword(password)) return res.status(401).json({ error: 'INVALID_PASSWORD' })
  res.setHeader('Set-Cookie', createAdminSessionCookie())
  return res.status(200).json({ ok: true })
}

function handleLogout(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  res.setHeader('Set-Cookie', clearAdminSessionCookie())
  return res.status(200).json({ ok: true })
}

function handleSession(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  return res.status(200).json({ authenticated: isAdminAuthenticated(req) })
}

async function handleGachaCollection(req, res) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['GET', 'POST'])) return

  try {
    if (req.method === 'GET') return res.status(200).json((await listGachaPools()) || [])
    const rows = await createGachaPool(cleanCreatePayload(getJsonBody(req)))
    return res.status(201).json(rows?.[0] || null)
  } catch (error) {
    console.error(error)
    const status = error.message === 'INVALID_GACHA_DATA' ? 400 : 500
    return res.status(status).json({ error: error.message || 'GACHA_WRITE_FAILED' })
  }
}

async function handleGachaItem(req, res, id) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['PATCH', 'DELETE'])) return
  if (!id) return res.status(400).json({ error: 'MISSING_ID' })

  try {
    if (req.method === 'PATCH') {
      const current = await dbRequest(`gacha_pools?id=eq.${encodeURIComponent(id)}&select=image_paths`)
      const oldPaths = current?.[0]?.image_paths || []
      const payload = cleanUpdatePayload(getJsonBody(req))
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
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error.message || 'GACHA_WRITE_FAILED' })
  }
}

async function handleUpload(req, res) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['POST'])) return

  try {
    const { data = '', mimeType = 'image/webp', year = new Date().getFullYear() } = getJsonBody(req)
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(mimeType)) {
      return res.status(400).json({ error: 'UNSUPPORTED_IMAGE_TYPE' })
    }

    const base64 = String(data).replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length || buffer.length > MAX_BYTES) return res.status(400).json({ error: 'IMAGE_TOO_LARGE' })

    const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg'
    const safeYear = String(year).replace(/[^0-9]/g, '').slice(0, 4) || String(new Date().getFullYear())
    const path = `gacha/${safeYear}/${crypto.randomUUID()}.${extension}`
    return res.status(201).json(await uploadImage({ buffer, path, contentType: mimeType }))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'IMAGE_UPLOAD_FAILED' })
  }
}

export default async function handler(req, res) {
  const parts = routeParts(req)
  const [resource, id] = parts

  if (parts.length === 1 && resource === 'login') return handleLogin(req, res)
  if (parts.length === 1 && resource === 'logout') return handleLogout(req, res)
  if (parts.length === 1 && resource === 'session') return handleSession(req, res)
  if (parts.length === 1 && resource === 'gacha') return handleGachaCollection(req, res)
  if (parts.length === 2 && resource === 'gacha') return handleGachaItem(req, res, id)
  if (parts.length === 1 && resource === 'upload') return handleUpload(req, res)

  return res.status(404).json({ error: 'NOT_FOUND' })
}
