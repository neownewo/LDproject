import { onlyMethods } from './_lib/http.js'
import { clearSessionCookie } from './_lib/auth.js'

export default async function handler(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return
  res.setHeader('Set-Cookie', clearSessionCookie())
  return res.status(200).json({ ok: true })
}
