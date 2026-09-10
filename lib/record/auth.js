import crypto from 'node:crypto'

const COOKIE_NAME = 'record_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const SCRYPT_KEYLEN = 64

function getSessionSecret() {
  return process.env.RECORD_SESSION_SECRET || ''
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return index === -1
          ? [part, '']
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

function sign(value) {
  const secret = getSessionSecret()
  if (!secret) throw new Error('RECORD_SESSION_SECRET is missing')
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

export function createSessionCookie(userId) {
  const payload = Buffer.from(JSON.stringify({
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })).toString('base64url')
  const token = `${payload}.${sign(payload)}`
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export function getSession(req) {
  try {
    if (!getSessionSecret()) return null
    const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME]
    if (!token) return null
    const [payload, signature] = token.split('.')
    if (!payload || !signature || !safeEqual(signature, sign(payload))) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.uid || Number(data.exp) < Math.floor(Date.now() / 1000)) return null
    return { userId: String(data.uid), expiresAt: Number(data.exp) }
  } catch {
    return null
  }
}

export function requireUser(req, res) {
  const session = getSession(req)
  if (session) return session
  res.status(401).json({ error: 'UNAUTHORIZED', message: '登入已失效，請重新登入。' })
  return null
}

function scryptAsync(value, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(value, salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

export async function hashHunterCode(code) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const derived = await scryptAsync(String(code), salt)
  return `scrypt$16384$8$1$${salt}$${derived.toString('base64url')}`
}

export async function verifyHunterCode(code, storedHash) {
  try {
    const parts = String(storedHash || '').split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const salt = parts[4]
    const expected = Buffer.from(parts[5], 'base64url')
    const derived = await scryptAsync(String(code), salt)
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}

export function validateAccount(value) {
  return /^[A-Za-z0-9]{1,50}$/.test(String(value || ''))
}

export function validateHunterCode(value) {
  return /^\d{5}$/.test(String(value || ''))
}

export function validateNickname(value) {
  const text = String(value || '')
  return text.length >= 1 && text.length <= 20 && /^[\u3400-\u4DBF\u4E00-\u9FFF]+$/u.test(text)
}
