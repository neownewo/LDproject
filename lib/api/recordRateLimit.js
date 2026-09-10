// Vercel Serverless 記憶體不保證跨 instance 共用，因此這只是第一層基本防護。
const attempts = globalThis.__recordLoginAttempts || new Map()
globalThis.__recordLoginAttempts = attempts

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

function keyFor(req, account) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const ip = forwarded || req.socket?.remoteAddress || 'unknown'
  return `${ip}:${String(account || '').toLowerCase()}`
}

export function checkLoginRateLimit(req, account) {
  const key = keyFor(req, account)
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || now - current.startedAt > WINDOW_MS) {
    attempts.set(key, { count: 0, startedAt: now })
    return { allowed: true, key }
  }
  if (current.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      key,
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000)),
    }
  }
  return { allowed: true, key }
}

export function noteLoginFailure(key) {
  const current = attempts.get(key) || { count: 0, startedAt: Date.now() }
  current.count += 1
  attempts.set(key, current)
}

export function clearLoginFailures(key) {
  attempts.delete(key)
}

export function failureDelay() {
  return new Promise((resolve) => setTimeout(resolve, 650 + Math.floor(Math.random() * 350)))
}
