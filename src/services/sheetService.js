export async function fetchSheetRows(url) {
  if (!url) throw new Error('Google Sheet API URL 尚未設定')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Google Sheet 資料讀取失敗：${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data)) {
    throw new Error('Google Sheet 回傳格式錯誤')
  }

  return data
}
