import { onlyMethods } from './_lib/http.js'
import { listGachaPools } from './_lib/supabase.js'

export default async function handler(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return
  try {
    const rows = await listGachaPools({ publishedOnly: true })
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json(rows || [])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'GACHA_READ_FAILED' })
  }
}
