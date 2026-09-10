import { onlyMethods, getJsonBody, sendError } from './_lib/http.js'
import { createSessionCookie, validateAccount, validateHunterCode, verifyHunterCode } from './_lib/auth.js'
import { findUserByAccount, touchLastLogin } from './_lib/supabase.js'
import { checkLoginRateLimit, noteLoginFailure, clearLoginFailures, failureDelay } from './_lib/rateLimit.js'

export default async function handler(req, res) {
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
    const user = await findUserByAccount(account)
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
    await touchLastLogin(user.id)
    res.setHeader('Set-Cookie', createSessionCookie(user.id))
    return res.status(200).json({ status: 'OK', nickname: user.nickname })
  } catch (error) {
    console.error('record login failed', error)
    return sendError(res, 500, 'LOGIN_FAILED', '登入失敗，請稍後再試。')
  }
}
