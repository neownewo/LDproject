import { createSessionCookie, verifyPassword } from '../_lib/auth.js'
import { getJsonBody, onlyMethods } from '../_lib/http.js'

export default function handler(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  const { password = '' } = getJsonBody(req)
  if (!verifyPassword(password)) return res.status(401).json({ error: 'INVALID_PASSWORD' })
  res.setHeader('Set-Cookie', createSessionCookie())
  res.status(200).json({ ok: true })
}
