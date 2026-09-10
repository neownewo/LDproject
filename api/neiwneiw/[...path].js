import crypto from 'node:crypto'
import { getJsonBody, onlyMethods } from '../../lib/api/http.js'
import { getRecordPools } from '../../lib/api/recordPools.js'
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
  if (Array.isArray(raw)) {
    return raw
      .flatMap((part) => String(part).split('/'))
      .filter(Boolean)
      .map(decodeURIComponent)
  }
  if (raw !== undefined && raw !== null && String(raw)) {
    return String(raw)
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent)
  }

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


function acquiredCopiesByRecord(cardRows) {
  const copies = new Map()
  for (const card of Array.isArray(cardRows) ? cardRows : []) {
    const rank = Number(card.rank)
    if (!Number.isInteger(rank) || rank < 0 || rank > 3) continue
    copies.set(card.record_id, (copies.get(card.record_id) || 0) + rank + 1)
  }
  return copies
}

function roundNumber(value, digits = 1) {
  const factor = 10 ** digits
  return Math.round((Number(value) || 0) * factor) / factor
}

async function handleRecordAnalytics(req, res) {
  if (!requireAdmin(req, res)) return
  if (!onlyMethods(req, res, ['GET'])) return

  try {
    const [users, records, cardRows, poolRows] = await Promise.all([
      dbRequest('record_users?select=id,account,nickname,created_at,last_login_at&order=created_at.desc'),
      dbRequest('gacha_records?select=id,user_id,pool_key,pull_count,amount_twd,created_at,updated_at&order=updated_at.desc'),
      dbRequest('gacha_record_cards?select=record_id,rank'),
      getRecordPools().catch(() => []),
    ])

    const safeUsers = Array.isArray(users) ? users : []
    const safeRecords = Array.isArray(records) ? records : []
    const copiesByRecord = acquiredCopiesByRecord(cardRows)
    const userById = new Map(safeUsers.map((user) => [user.id, user]))
    const poolByKey = new Map((Array.isArray(poolRows) ? poolRows : []).map((pool) => [pool.poolKey, pool]))

    const userStats = new Map(safeUsers.map((user) => [user.id, {
      id: user.id,
      account: user.account,
      nickname: user.nickname,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      recordCount: 0,
      totalPulls: 0,
      totalAmount: 0,
      totalCopies: 0,
    }]))

    const poolGroups = new Map()
    for (const record of safeRecords) {
      const pulls = Number(record.pull_count) || 0
      const amount = Number(record.amount_twd) || 0
      const copies = copiesByRecord.get(record.id) || 0
      const user = userById.get(record.user_id)
      const userName = user?.nickname || user?.account || '未知使用者'

      if (!userStats.has(record.user_id)) {
        userStats.set(record.user_id, {
          id: record.user_id,
          account: user?.account || '',
          nickname: user?.nickname || '未知使用者',
          createdAt: user?.created_at || '',
          lastLoginAt: user?.last_login_at || '',
          recordCount: 0,
          totalPulls: 0,
          totalAmount: 0,
          totalCopies: 0,
        })
      }
      const u = userStats.get(record.user_id)
      u.recordCount += 1
      u.totalPulls += pulls
      u.totalAmount += amount
      u.totalCopies += copies

      if (!poolGroups.has(record.pool_key)) poolGroups.set(record.pool_key, [])
      poolGroups.get(record.pool_key).push({
        userId: record.user_id,
        nickname: userName,
        account: user?.account || '',
        pulls,
        amount,
        copies,
        pullsPerCopy: copies > 0 ? pulls / copies : null,
      })
    }

    const poolStats = [...poolGroups.entries()].map(([poolKey, entries]) => {
      const meta = poolByKey.get(poolKey)
      const totalPulls = entries.reduce((sum, row) => sum + row.pulls, 0)
      const totalAmount = entries.reduce((sum, row) => sum + row.amount, 0)
      const totalCopies = entries.reduce((sum, row) => sum + row.copies, 0)
      const luckEntries = entries.filter((row) => row.pullsPerCopy !== null)
      const mostLucky = luckEntries.length
        ? luckEntries.reduce((best, row) => row.pullsPerCopy < best.pullsPerCopy ? row : best)
        : null
      const mostUnlucky = luckEntries.length
        ? luckEntries.reduce((worst, row) => row.pullsPerCopy > worst.pullsPerCopy ? row : worst)
        : null
      const highestSpend = entries.length
        ? entries.reduce((best, row) => row.amount > best.amount ? row : best)
        : null
      const lowestSpend = entries.length
        ? entries.reduce((best, row) => row.amount < best.amount ? row : best)
        : null

      return {
        poolKey,
        name: meta?.name || poolKey,
        startDate: meta?.startDate || '',
        poolType: meta?.poolType || '',
        characters: meta?.characters || [],
        participantCount: entries.length,
        totalPulls,
        totalAmount,
        totalCopies,
        averagePullsPerPerson: entries.length ? roundNumber(totalPulls / entries.length) : 0,
        averageAmountPerPerson: entries.length ? Math.round(totalAmount / entries.length) : 0,
        averagePullsPerCopy: totalCopies ? roundNumber(totalPulls / totalCopies) : 0,
        mostLucky: mostLucky ? {
          nickname: mostLucky.nickname,
          account: mostLucky.account,
          pulls: mostLucky.pulls,
          copies: mostLucky.copies,
          pullsPerCopy: roundNumber(mostLucky.pullsPerCopy),
        } : null,
        mostUnlucky: mostUnlucky ? {
          nickname: mostUnlucky.nickname,
          account: mostUnlucky.account,
          pulls: mostUnlucky.pulls,
          copies: mostUnlucky.copies,
          pullsPerCopy: roundNumber(mostUnlucky.pullsPerCopy),
        } : null,
        highestSpend: highestSpend ? {
          nickname: highestSpend.nickname,
          account: highestSpend.account,
          amount: highestSpend.amount,
        } : null,
        lowestSpend: lowestSpend ? {
          nickname: lowestSpend.nickname,
          account: lowestSpend.account,
          amount: lowestSpend.amount,
        } : null,
      }
    }).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)) || a.name.localeCompare(b.name, 'zh-Hant'))

    const usersResult = [...userStats.values()]
      .map((user) => ({
        ...user,
        averagePullsPerCopy: user.totalCopies ? roundNumber(user.totalPulls / user.totalCopies) : 0,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

    const activeUserIds = new Set(safeRecords.map((row) => row.user_id))
    const totalPulls = safeRecords.reduce((sum, row) => sum + (Number(row.pull_count) || 0), 0)
    const totalAmount = safeRecords.reduce((sum, row) => sum + (Number(row.amount_twd) || 0), 0)
    const totalCopies = [...copiesByRecord.values()].reduce((sum, value) => sum + value, 0)

    return res.status(200).json({
      summary: {
        accountCount: safeUsers.length,
        activeAccountCount: activeUserIds.size,
        recordCount: safeRecords.length,
        poolCount: poolGroups.size,
        totalPulls,
        totalAmount,
        totalCopies,
        averagePullsPerCopy: totalCopies ? roundNumber(totalPulls / totalCopies) : 0,
      },
      users: usersResult,
      pools: poolStats,
    })
  } catch (error) {
    console.error('neiwneiw record analytics failed', error)
    return res.status(500).json({ error: error.message || 'RECORD_ANALYTICS_FAILED' })
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
  if (parts.length === 1 && resource === 'records') return handleRecordAnalytics(req, res)
  if (parts.length === 2 && resource === 'gacha') return handleGachaItem(req, res, id)
  if (parts.length === 1 && resource === 'upload') return handleUpload(req, res)

  return res.status(404).json({ error: 'NOT_FOUND' })
}
