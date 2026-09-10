import crypto from 'node:crypto'

const COOKIE_NAME = 'neiwneiw_session'
const SESSION_MAX_AGE = 60 * 60 * 12

function getSecret() {
  return process.env.NEIWNEIW_SESSION_SECRET || process.env.NEIWNEIW_PASSWORD || ''
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

export function verifyPassword(password) {
  const expected = process.env.NEIWNEIW_PASSWORD || ''
  return Boolean(expected && safeEqual(password, expected))
}

export function createSessionCookie() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  const payload = String(expiresAt)
  const token = `${payload}.${sign(payload)}`
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

export function isAuthenticated(req) {
  const secret = getSecret()
  if (!secret) return false

  const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME]
  if (!token) return false

  const [expiresAt, signature] = token.split('.')
  if (!expiresAt || !signature) return false
  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return false

  return safeEqual(signature, sign(expiresAt))
}

export function requireAdmin(req, res) {
  if (isAuthenticated(req)) return true
  res.status(401).json({ error: 'UNAUTHORIZED' })
  return false
}
