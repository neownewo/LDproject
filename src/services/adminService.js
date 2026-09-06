async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return data
}

export function getAdminSession() {
  return request('/api/neiwneiw/session')
}

export function loginAdmin(password) {
  return request('/api/neiwneiw/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logoutAdmin() {
  return request('/api/neiwneiw/logout', { method: 'POST', body: '{}' })
}

export function fetchAdminGachaPools() {
  return request('/api/neiwneiw/gacha')
}

export function createAdminGachaPool(payload) {
  return request('/api/neiwneiw/gacha', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAdminGachaPool(id, payload) {
  return request(`/api/neiwneiw/gacha/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteAdminGachaPool(id) {
  return request(`/api/neiwneiw/gacha/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: '{}',
  })
}

export function uploadAdminImage(payload) {
  return request('/api/neiwneiw/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
