import crypto from 'node:crypto'
import { requireAdmin } from '../_lib/auth.js'
import { getJsonBody, onlyMethods } from '../_lib/http.js'
import { uploadImage } from '../_lib/supabase.js'

const MAX_BYTES = 2 * 1024 * 1024

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['POST'])) return

  try {
    const { data = '', mimeType = 'image/webp', year = new Date().getFullYear() } = getJsonBody(req)
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(mimeType)) {
      return res.status(400).json({ error: 'UNSUPPORTED_IMAGE_TYPE' })
    }

    const base64 = String(data).replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length || buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'IMAGE_TOO_LARGE' })
    }

    const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg'
    const safeYear = String(year).replace(/[^0-9]/g, '').slice(0, 4) || String(new Date().getFullYear())
    const path = `gacha/${safeYear}/${crypto.randomUUID()}.${extension}`
    res.status(201).json(await uploadImage({ buffer, path, contentType: mimeType }))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'IMAGE_UPLOAD_FAILED' })
  }
}
