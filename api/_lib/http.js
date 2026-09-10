export function onlyMethods(req, res, methods) {
  if (methods.includes(req.method)) return true
  res.setHeader('Allow', methods.join(', '))
  res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  return false
}

export function getJsonBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body
}
