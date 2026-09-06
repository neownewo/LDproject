export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1600,
    quality = 0.82,
    type = 'image/webp',
  } = options

  if (!file?.type?.startsWith('image/')) throw new Error('請選擇圖片檔案')

  const imageBitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / imageBitmap.width, maxHeight / imageBitmap.height)
  const width = Math.max(1, Math.round(imageBitmap.width * scale))
  const height = Math.max(1, Math.round(imageBitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(imageBitmap, 0, 0, width, height)
  imageBitmap.close?.()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('圖片壓縮失敗'))
    }, type, quality)
  })

  return {
    blob,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
    type,
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
