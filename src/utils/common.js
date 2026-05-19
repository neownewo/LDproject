
export function parseFlexibleDate(dateString) {
  if (!dateString) return null

  if (dateString.includes('/')) {
    const parts = dateString.split('/')

    if (parts.length === 3) {
      return new Date(dateString)
    }

    if (parts.length === 2) {
      const year = new Date().getFullYear()
      return new Date(`${year}/${dateString}`)
    }
  }

  return new Date(dateString)
}

export function isExpired(endDate) {
  const parsed = parseFlexibleDate(endDate)

  if (!parsed) return true

  const today = new Date()
  today.setHours(0,0,0,0)

  parsed.setHours(23,59,59,999)

  return parsed < today
}

export function getGoogleMapEmbed(address) {
  if (!address) return ''
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

export const characterImages = {
  沈星回: '/image/Aster.png',
  夏以晝: '/image/Caleb.png',
  祁煜: '/image/Rafayel.png',
  秦徹: '/image/Sylus.png',
  黎深: '/image/Zayne.png',
}

export function getCharacterImage(character) {
  return characterImages[character] || '/image/Sylus.png'
}

export function detectContentType(url) {
  if (!url) return 'unknown'

  if (url.includes('notion.site')) return 'notion'

  if (url.includes('docs.google.com/presentation') || url.includes('pubembed')) {
    return 'slides'
  }

  return 'unknown'
}

export function getEmbedUrl(input) {
  if (!input) return ''

  const iframeMatch = input.match(/src="([^"]+)"/)

  if (iframeMatch) {
    return iframeMatch[1]
  }

  if (input.includes('docs.google.com/presentation')) {
    return input
      .replace('/edit?usp=sharing', '/embed?start=false&loop=false&delayms=5000')
      .replace('/pub?', '/embed?')
  }

  return input
}
