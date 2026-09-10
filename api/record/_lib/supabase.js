function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Supabase environment variables are missing')
  return { url, key }
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
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // 舊版 service_role JWT 仍使用 Bearer；新版 sb_secret_ 僅以 apikey 使用即可。
  if (!String(key).startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${key}`
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers,
  })
  return parseResponse(response)
}

export async function findUserByAccount(account) {
  const rows = await dbRequest(`record_users?select=id,account,hunter_code_hash,nickname,created_at,last_login_at&account=eq.${encodeURIComponent(account)}&limit=1`)
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function findUserById(id) {
  const rows = await dbRequest(`record_users?select=id,nickname,created_at,last_login_at&id=eq.${encodeURIComponent(id)}&limit=1`)
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function createUser({ account, hunterCodeHash, nickname }) {
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

export async function touchLastLogin(id) {
  await dbRequest(`record_users?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
  })
}

export async function listRecords(userId) {
  return dbRequest(
    `gacha_records?select=id,pool_key,rank,pull_count,amount_twd,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
  )
}

export async function upsertRecord(userId, payload) {
  const rows = await dbRequest('gacha_records?on_conflict=user_id,pool_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      pool_key: payload.poolKey,
      rank: payload.rank,
      pull_count: payload.pullCount,
      amount_twd: payload.amountTwd,
    }),
  })
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function deleteRecord(userId, poolKey) {
  return dbRequest(
    `gacha_records?user_id=eq.${encodeURIComponent(userId)}&pool_key=eq.${encodeURIComponent(poolKey)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  )
}

export async function listPublishedGachaPools() {
  return dbRequest('gacha_pools?select=*&is_published=eq.true&order=start_date.desc,created_at.desc')
}
