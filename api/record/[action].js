import { getJsonBody, onlyMethods, sendError } from '../../lib/api/http.js'
import {
  clearRecordSessionCookie,
  createRecordSessionCookie,
  getRecordSession,
  hashHunterCode,
  requireRecordUser,
  validateAccount,
  validateHunterCode,
  validateNickname,
  verifyHunterCode,
} from '../../lib/api/recordAuth.js'
import {
  createRecordUser,
  dbRequest,
  deleteRecordEntry,
  findRecordUserByAccount,
  findRecordUserById,
  listRecordEntries,
  touchRecordLastLogin,
  upsertRecordEntry,
} from '../../lib/api/supabase.js'
import { getRecordPools } from '../../lib/api/recordPools.js'
import {
  checkLoginRateLimit,
  clearLoginFailures,
  failureDelay,
  noteLoginFailure,
} from '../../lib/api/recordRateLimit.js'

function actionName(req) {
  const raw = req.query?.action
  if (Array.isArray(raw)) return String(raw[0] || '')
  if (raw !== undefined && raw !== null) return String(raw)
  const pathname = String(req.url || '').split('?')[0]
  return decodeURIComponent(pathname.replace(/^\/api\/record\/?/, '').split('/')[0] || '')
}

function validatePoolKey(value) {
  return /^(legacy:[a-f0-9]{24}|supabase:[0-9a-fA-F-]{20,})$/.test(String(value || ''))
}

function parseInteger(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

async function handleLogin(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  const body = getJsonBody(req)
  const account = String(body.account || '').trim()
  const hunterCode = String(body.hunterCode || '').trim()

  if (!validateAccount(account) || !validateHunterCode(hunterCode)) {
    return sendError(res, 400, 'INVALID_INPUT', '請確認帳號與獵人編號格式。')
  }

  const rate = checkLoginRateLimit(req, account)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '嘗試次數過多，請稍後再試。')
  }

  try {
    const user = await findRecordUserByAccount(account)
    if (!user) {
      clearLoginFailures(rate.key)
      return res.status(200).json({ status: 'NEW_ACCOUNT' })
    }

    const valid = await verifyHunterCode(hunterCode, user.hunter_code_hash)
    if (!valid) {
      noteLoginFailure(rate.key)
      await failureDelay()
      return sendError(res, 401, 'INVALID_CREDENTIALS', '帳號或獵人編號不正確。')
    }

    clearLoginFailures(rate.key)
    await touchRecordLastLogin(user.id)
    res.setHeader('Set-Cookie', createRecordSessionCookie(user.id))
    return res.status(200).json({ status: 'OK', nickname: user.nickname })
  } catch (error) {
    console.error('record login failed', error)
    return sendError(res, 500, 'LOGIN_FAILED', '登入失敗，請稍後再試。')
  }
}

async function handleRegister(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  const body = getJsonBody(req)
  const account = String(body.account || '').trim()
  const hunterCode = String(body.hunterCode || '').trim()
  const nickname = String(body.nickname || '').trim()

  if (!validateAccount(account)) return sendError(res, 400, 'INVALID_ACCOUNT', '帳號僅限英文字母與數字。')
  if (!validateHunterCode(hunterCode)) return sendError(res, 400, 'INVALID_HUNTER_CODE', '獵人編號請輸入後 5 碼。')
  if (!validateNickname(nickname)) return sendError(res, 400, 'INVALID_NICKNAME', '暱稱僅限中文，最多 20 個字。')

  try {
    const existed = await findRecordUserByAccount(account)
    if (existed) return sendError(res, 409, 'ACCOUNT_EXISTS', '這個帳號已經存在，請回登入畫面。')

    const hunterCodeHash = await hashHunterCode(hunterCode)
    const user = await createRecordUser({ account, hunterCodeHash, nickname })
    if (!user?.id) throw new Error('User was not created')

    res.setHeader('Set-Cookie', createRecordSessionCookie(user.id))
    return res.status(201).json({ status: 'OK', nickname: user.nickname })
  } catch (error) {
    console.error('record register failed', error)
    if (String(error?.message || '').toLowerCase().includes('duplicate')) {
      return sendError(res, 409, 'ACCOUNT_EXISTS', '這個帳號已經存在，請回登入畫面。')
    }
    return sendError(res, 500, 'REGISTER_FAILED', '建立帳號失敗，請稍後再試。')
  }
}

async function handleSession(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  const session = getRecordSession(req)
  if (!session) return res.status(200).json({ authenticated: false })

  try {
    const user = await findRecordUserById(session.userId)
    if (!user) {
      res.setHeader('Set-Cookie', clearRecordSessionCookie())
      return res.status(200).json({ authenticated: false })
    }
    return res.status(200).json({ authenticated: true, nickname: user.nickname })
  } catch (error) {
    console.error('record session failed', error)
    return res.status(500).json({ error: 'SESSION_FAILED' })
  }
}

function handleLogout(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  res.setHeader('Set-Cookie', clearRecordSessionCookie())
  return res.status(200).json({ ok: true })
}

async function handlePools(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  if (!requireRecordUser(req, res)) return

  try {
    const pools = await getRecordPools()
    res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(pools)
  } catch (error) {
    console.error('record pools failed', error)
    return res.status(500).json({ error: 'POOLS_FAILED', message: '卡池資料讀取失敗。' })
  }
}


async function handleLuck(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  const session = requireRecordUser(req, res)
  if (!session) return

  const rawPoolKey = Array.isArray(req.query?.poolKey) ? req.query.poolKey[0] : req.query?.poolKey
  const poolKey = String(rawPoolKey || '').trim()
  if (!validatePoolKey(poolKey)) return sendError(res, 400, 'INVALID_POOL', '卡池識別碼不正確。')

  try {
    // 歐氣百分比只比較「目前這一個卡池」，不同卡池不共用同一個全站平均。
    const rows = await dbRequest(
      `gacha_records?select=user_id,pull_count,gold_count&pool_key=eq.${encodeURIComponent(poolKey)}`,
    )

    const averages = new Map()
    for (const row of Array.isArray(rows) ? rows : []) {
      const pulls = Number(row.pull_count) || 0
      const gold = Number(row.gold_count) || 0
      if (pulls <= 0 || gold <= 0) continue
      averages.set(row.user_id, pulls / gold)
    }

    const myAverage = averages.get(session.userId)
    if (!Number.isFinite(myAverage)) {
      return res.status(200).json({ available: false, message: '完成這個卡池的抽卡紀錄後，就能看看你的歐氣 ✦' })
    }

    const others = [...averages.entries()]
      .filter(([userId]) => userId !== session.userId)
      .map(([, average]) => average)

    if (!others.length) {
      return res.status(200).json({ available: false, message: '這個卡池目前還沒有足夠資料可以比較 ✦' })
    }

    const worse = others.filter((average) => average > myAverage).length
    // 文案寫的是『超越 X%』，因此只計算真的比目前使用者差的人；同分不算被超越。
    const percent = Math.max(0, Math.min(100, Math.round((worse / others.length) * 100)))

    // 指定梗只決定顯示文字，不參與、也不改動百分比計算。
    const targeted = await dbRequest(`record_luck_messages?select=id,message,sort_no&enabled=eq.true&target_user_id=eq.${encodeURIComponent(session.userId)}&min_percent=lte.${percent}&max_percent=gte.${percent}&order=sort_no.asc`)
    let candidates = Array.isArray(targeted) ? targeted : []
    if (!candidates.length) {
      const general = await dbRequest(`record_luck_messages?select=id,message,sort_no&enabled=eq.true&target_user_id=is.null&min_percent=lte.${percent}&max_percent=gte.${percent}&order=sort_no.asc`)
      candidates = Array.isArray(general) ? general : []
    }

    const chosen = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
    return res.status(200).json({ available: true, percent, message: chosen?.message || '平穩發揮中 ✦' })
  } catch (error) {
    console.error('record luck failed', error)
    return sendError(res, 500, 'LUCK_FAILED', '歐氣資料讀取失敗。')
  }
}

async function handleRecords(req, res) {
  if (!onlyMethods(req, res, ['GET', 'PUT', 'DELETE'])) return
  const session = requireRecordUser(req, res)
  if (!session) return

  try {
    if (req.method === 'GET') {
      const rows = await listRecordEntries(session.userId)
      return res.status(200).json(Array.isArray(rows) ? rows : [])
    }

    const body = getJsonBody(req)
    const poolKey = String(body.poolKey || '').trim()
    if (!validatePoolKey(poolKey)) return sendError(res, 400, 'INVALID_POOL', '卡池識別碼不正確。')

    if (req.method === 'DELETE') {
      await deleteRecordEntry(session.userId, poolKey)
      return res.status(200).json({ ok: true })
    }

    const pullCount = parseInteger(body.pullCount)
    const goldCount = parseInteger(body.goldCount)
    const selectBoxOpened = body.selectBoxOpened === true
    const amountTwd = parseInteger(body.amountTwd)
    const note = String(body.note ?? '')
    const rawCards = Array.isArray(body.cards) ? body.cards : []

    if (pullCount === null || pullCount < 0 || pullCount > 1000000) return sendError(res, 400, 'INVALID_PULL_COUNT', '抽數不正確。')
    if (goldCount === null || goldCount < 0 || goldCount > 1000000) return sendError(res, 400, 'INVALID_GOLD_COUNT', '出金總次數不正確。')
    if (goldCount > pullCount) return sendError(res, 400, 'INVALID_GOLD_COUNT', '出金總次數不能大於總抽數。')
    if (amountTwd === null || amountTwd < 0 || amountTwd > 100000000) return sendError(res, 400, 'INVALID_AMOUNT', '課金金額不正確。')
    if (note.length > 100) return sendError(res, 400, 'INVALID_NOTE', '備註最多只能輸入 100 字。')
    if (rawCards.length > 20) return sendError(res, 400, 'INVALID_CARDS', '卡片紀錄數量不正確。')

    const cards = []
    const seen = new Set()
    for (const item of rawCards) {
      const cardKey = String(item?.cardKey || '').trim()
      const cardIndex = parseInteger(item?.cardIndex)
      const rank = parseInteger(item?.rank)
      const cardLabel = String(item?.cardLabel || '').trim().slice(0, 100)
      const imageUrl = String(item?.imageUrl || '').trim().slice(0, 2000)

      if (!/^card:\d+$/.test(cardKey) || cardIndex === null || cardIndex < 0 || cardIndex > 19) {
        return sendError(res, 400, 'INVALID_CARD', '卡片識別資料不正確。')
      }
      if (rank === null || rank < 0 || rank > 3) return sendError(res, 400, 'INVALID_RANK', '疊卡層級不正確。')
      if (seen.has(cardKey)) return sendError(res, 400, 'DUPLICATE_CARD', '卡片紀錄不可重複。')
      seen.add(cardKey)
      cards.push({ cardKey, cardIndex, cardLabel, imageUrl, rank })
    }

    if (selectBoxOpened) {
      const pools = await getRecordPools()
      const pool = (Array.isArray(pools) ? pools : []).find((item) => item.poolKey === poolKey)
      const minPulls = pool?.poolType === 'multi' ? 200 : pool?.poolType === 'daily' ? 150 : null
      if (!minPulls) return sendError(res, 400, 'INVALID_SELECT_BOX', '這個卡池沒有自選盒紀錄。')
      if (pullCount < minPulls) return sendError(res, 400, 'INVALID_SELECT_BOX', `此卡池需滿 ${minPulls} 抽才能開自選盒。`)
    }

    const saved = await upsertRecordEntry(session.userId, { poolKey, pullCount, goldCount, selectBoxOpened, amountTwd, note, cards })
    return res.status(200).json(saved || { pool_key: poolKey, pull_count: pullCount, gold_count: goldCount, select_box_opened: selectBoxOpened, amount_twd: amountTwd, note, cards })
  } catch (error) {
    console.error('record records failed', error)
    return sendError(res, 500, 'RECORD_FAILED', '紀錄儲存失敗，請稍後再試。')
  }
}

export default async function handler(req, res) {
  switch (actionName(req)) {
    case 'login': return handleLogin(req, res)
    case 'register': return handleRegister(req, res)
    case 'session': return handleSession(req, res)
    case 'logout': return handleLogout(req, res)
    case 'pools': return handlePools(req, res)
    case 'records': return handleRecords(req, res)
    case 'luck': return handleLuck(req, res)
    default: return res.status(404).json({ error: 'NOT_FOUND' })
  }
}
