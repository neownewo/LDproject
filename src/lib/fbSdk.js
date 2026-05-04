// src/lib/fbSdk.js
let loadingPromise = null

export function loadFacebookSDK({ locale = 'zh_TW' } = {}) {
  // 只載入一次
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise((resolve, reject) => {
    // 如果已存在 SDK script
    if (document.getElementById('facebook-jssdk')) {
      resolve()
      return
    }

    // FB SDK 需要這個 root
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div')
      root.id = 'fb-root'
      document.body.prepend(root)
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = `https://connect.facebook.net/${locale}/sdk.js#xfbml=1&version=v20.0`

    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'))

    document.body.appendChild(script)
  })

  return loadingPromise
}

export function parseFacebookXFBML() {
  // FB 會掛在 window.FB
  if (window.FB?.XFBML?.parse) {
    window.FB.XFBML.parse()
  }
}
