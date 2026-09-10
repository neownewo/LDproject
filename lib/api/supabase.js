const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media'

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Supabase environment variables are missing')
  return { url, key }
}

function authHeaders(key) {
  const headers = { apikey: key }
  // 舊版 service_role JWT 使用 Bearer；新版 sb_secret_ 僅使用 apikey。
  if (!String(key).startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`
  return headers
}

async function parseResponse(response) {
  if (response.status === 204) return null
  const text = await response.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data
      ? (data.message || data.error || JSON.stringify(data))
      : data
    throw new Error(message || `Supabase request failed: ${response.status}`)
  }
  return data
}

export async function dbRequest(path, options = {}) {
  const { url, key } = config()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders(key),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return parseResponse(response)
}

// ----- 卡池（公開站 / neiwneiw / record 共用） -----
export async function listGachaPools({ publishedOnly = false } = {}) {
  const filters = publishedOnly ? '&is_published=eq.true' : ''
  return dbRequest(`gacha_pools?select=*&order=start_date.desc,created_at.desc${filters}`)
}

export async function listPublishedGachaPools() {
  return listGachaPools({ publishedOnly: true })
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
      ...authHeaders(key),
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
        headers: authHeaders(key),
      },
    )
    if (!response.ok && response.status !== 404) await parseResponse(response)
  }
}

// ----- 抽卡紀錄使用者 / 紀錄 -----
export async function findRecordUserByAccount(account) {
  const rows = await dbRequest(`record_users?select=id,account,hunter_code_hash,nickname,created_at,last_login_at&account=eq.${encodeURIComponent(account)}&limit=1`)
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function findRecordUserById(id) {
  const rows = await dbRequest(`record_users?select=id,nickname,created_at,last_login_at&id=eq.${encodeURIComponent(id)}&limit=1`)
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function createRecordUser({ account, hunterCodeHash, nickname }) {
  const rows = await dbRequest('record_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account,
      hunter_code_hash: hunterCodeHash,
      nickname,
      last_login_at: new Date().toISOString(),
    }),
  })
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function touchRecordLastLogin(id) {
  await dbRequest(`record_users?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
  })
}

export async function listRecordEntries(userId) {
  const records = await dbRequest(
    `gacha_records?select=id,pool_key,rank,pull_count,amount_twd,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
  )
  if (!Array.isArray(records) || !records.length) return []

  const ids = records.map((row) => row.id).filter(Boolean)
  if (!ids.length) return records.map((row) => ({ ...row, cards: [] }))

  const cardRows = await dbRequest(
    `gacha_record_cards?select=id,record_id,card_key,card_index,card_label,image_url,rank,created_at,updated_at&record_id=in.(${ids.join(',')})&order=card_index.asc`,
  )
  const byRecord = new Map()
  for (const card of Array.isArray(cardRows) ? cardRows : []) {
    if (!byRecord.has(card.record_id)) byRecord.set(card.record_id, [])
    byRecord.get(card.record_id).push(card)
  }
  return records.map((row) => ({ ...row, cards: byRecord.get(row.id) || [] }))
}

export async function upsertRecordEntry(userId, payload) {
  const legacyRank = payload.cards?.[0]?.rank ?? 0
  const rows = await dbRequest('gacha_records?on_conflict=user_id,pool_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      pool_key: payload.poolKey,
      rank: legacyRank,
      pull_count: payload.pullCount,
      amount_twd: payload.amountTwd,
    }),
  })
  const record = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!record?.id) return record

  await dbRequest(`gacha_record_cards?record_id=eq.${encodeURIComponent(record.id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })

  const cards = Array.isArray(payload.cards) ? payload.cards : []
  if (cards.length) {
    await dbRequest('gacha_record_cards', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(cards.map((card) => ({
        record_id: record.id,
        card_key: card.cardKey,
        card_index: card.cardIndex,
        card_label: card.cardLabel || '',
        image_url: card.imageUrl || '',
        rank: card.rank,
      }))),
    })
  }

  return {
    ...record,
    cards: cards.map((card) => ({
      card_key: card.cardKey,
      card_index: card.cardIndex,
      card_label: card.cardLabel || '',
      image_url: card.imageUrl || '',
      rank: card.rank,
    })),
  }
}

export async function deleteRecordEntry(userId, poolKey) {
  return dbRequest(
    `gacha_records?user_id=eq.${encodeURIComponent(userId)}&pool_key=eq.${encodeURIComponent(poolKey)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  )
}

