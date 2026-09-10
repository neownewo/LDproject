import { onlyMethods, getJsonBody, sendError } from '../../lib/record/http.js'
import { createSessionCookie, hashHunterCode, validateAccount, validateHunterCode, validateNickname } from '../../lib/record/auth.js'
import { createUser, findUserByAccount } from '../../lib/record/supabase.js'

export default async function handler(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  const body = getJsonBody(req)
  const account = String(body.account || '').trim()
  const hunterCode = String(body.hunterCode || '').trim()
  const nickname = String(body.nickname || '').trim()

  if (!validateAccount(account)) return sendError(res, 400, 'INVALID_ACCOUNT', '帳號僅限英文字母與數字。')
  if (!validateHunterCode(hunterCode)) return sendError(res, 400, 'INVALID_HUNTER_CODE', '獵人編號請輸入後 5 碼。')
  if (!validateNickname(nickname)) return sendError(res, 400, 'INVALID_NICKNAME', '暱稱僅限中文，最多 20 個字。')

  try {
    const existed = await findUserByAccount(account)
    if (existed) return sendError(res, 409, 'ACCOUNT_EXISTS', '這個帳號已經存在，請回登入畫面。')

    const hunterCodeHash = await hashHunterCode(hunterCode)
    const user = await createUser({ account, hunterCodeHash, nickname })
    if (!user?.id) throw new Error('User was not created')

    res.setHeader('Set-Cookie', createSessionCookie(user.id))
    return res.status(201).json({ status: 'OK', nickname: user.nickname })
  } catch (error) {
    console.error('record register failed', error)
    if (String(error?.message || '').toLowerCase().includes('duplicate')) {
      return sendError(res, 409, 'ACCOUNT_EXISTS', '這個帳號已經存在，請回登入畫面。')
    }
    return sendError(res, 500, 'REGISTER_FAILED', '建立帳號失敗，請稍後再試。')
  }
}
