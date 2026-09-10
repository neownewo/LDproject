import { onlyMethods } from '../../lib/record/http.js'
import { getSession, clearSessionCookie } from '../../lib/record/auth.js'
import { findUserById } from '../../lib/record/supabase.js'

export default async function handler(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  const session = getSession(req)
  if (!session) return res.status(200).json({ authenticated: false })

  try {
    const user = await findUserById(session.userId)
    if (!user) {
      res.setHeader('Set-Cookie', clearSessionCookie())
      return res.status(200).json({ authenticated: false })
    }
    return res.status(200).json({ authenticated: true, nickname: user.nickname })
  } catch (error) {
    console.error('record session failed', error)
    return res.status(500).json({ error: 'SESSION_FAILED' })
  }
}
