import { clearSessionCookie } from '../_lib/auth.js'
import { onlyMethods } from '../_lib/http.js'

export default function handler(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.status(200).json({ ok: true })
}
