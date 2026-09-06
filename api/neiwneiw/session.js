import { isAuthenticated } from '../_lib/auth.js'
import { onlyMethods } from '../_lib/http.js'

export default function handler(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  res.status(200).json({ authenticated: isAuthenticated(req) })
}
