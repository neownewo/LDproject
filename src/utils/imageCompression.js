const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

function encodeCanvas(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('圖片轉換失敗，請更換圖片格式後重試'))
    }, mimeType, quality)
  })
}

export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1600,
    quality = 0.82,
    type = 'image/webp',
    maxBytes = DEFAULT_MAX_BYTES,
  } = options

  if (!file?.type?.startsWith('image/')) throw new Error('請選擇圖片檔案')

  const bitmap = await createImageBitmap(file)
  try {
    const baseScale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    const baseWidth = Math.max(1, Math.round(bitmap.width * baseScale))
    const baseHeight = Math.max(1, Math.round(bitmap.height * baseScale))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('瀏覽器無法處理圖片，請更換瀏覽器後重試')

    let smallest = null
    const formats = type === 'image/webp' ? ['image/webp', 'image/jpeg'] : [type]
    for (const ratio of [1, 0.85, 0.7, 0.55]) {
      const width = Math.max(1, Math.round(baseWidth * ratio))
      const height = Math.max(1, Math.round(baseHeight * ratio))
      canvas.width = width
      canvas.height = height
      ctx.clearRect(0, 0, width, height)
      // JPEG does not support transparency; white is a predictable background.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)

      for (const mimeType of formats) {
        for (const q of [quality, 0.7, 0.55, 0.4]) {
          const blob = await encodeCanvas(canvas, mimeType, q)
          // Safari may silently return PNG when the requested format is unsupported.
          if (blob.type !== mimeType) continue
          const candidate = { blob, width, height, originalSize: file.size, compressedSize: blob.size, type: blob.type }
          if (!smallest || candidate.compressedSize < smallest.compressedSize) smallest = candidate
          if (blob.size <= maxBytes) return candidate
        }
      }
    }

    const originalKB = (file.size / 1024).toFixed(0)
    const compressedKB = smallest ? (smallest.compressedSize / 1024).toFixed(0) : '未知'
    throw new Error(`圖片無法壓縮至 2MB 以內（原圖 ${originalKB} KB，處理後 ${compressedKB} KB）`)
  } finally {
    bitmap.close?.()
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('無法讀取處理後的圖片'))
    reader.readAsDataURL(blob)
  })
}
