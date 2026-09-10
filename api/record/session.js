import { onlyMethods } from './_lib/http.js'
import { getSession, clearSessionCookie } from './_lib/auth.js'
import { findUserById } from './_lib/supabase.js'

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
