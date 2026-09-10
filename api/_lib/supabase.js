const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media'

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Supabase environment variables are missing')
  return { url, key }
}

async function parseResponse(response) {
  if (response.status === 204) return null
  const text = await response.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null
  if (!response.ok) {
    const message = typeof data === 'object' ? (data.message || data.error || JSON.stringify(data)) : data
    throw new Error(message || `Supabase request failed: ${response.status}`)
  }
  return data
}

export async function dbRequest(path, options = {}) {
  const { url, key } = config()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return parseResponse(response)
}

export async function listGachaPools({ publishedOnly = false } = {}) {
  const filters = publishedOnly ? '&is_published=eq.true' : ''
  return dbRequest(`gacha_pools?select=*&order=start_date.desc,created_at.desc${filters}`)
}

export async function createGachaPool(payload) {
  return dbRequest('gacha_pools', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
}

export async function updateGachaPool(id, payload) {
  return dbRequest(`gacha_pools?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
}

export async function deleteGachaPool(id) {
  return dbRequest(`gacha_pools?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
}

function encodeStoragePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/')
}

export async function uploadImage({ buffer, path, contentType = 'image/webp' }) {
  const { url, key } = config()
  const encoded = encodeStoragePath(path)
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encoded}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-upsert': 'false',
    },
    body: buffer,
  })
  await parseResponse(response)
  return {
    path,
    url: `${url}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encoded}`,
  }
}

export async function deleteImages(paths = []) {
  const { url, key } = config()
  for (const path of paths.filter(Boolean)) {
    const response = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeStoragePath(path)}`,
      {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      },
    )
    if (!response.ok && response.status !== 404) await parseResponse(response)
  }
}
