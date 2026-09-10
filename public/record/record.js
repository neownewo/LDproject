const state = {
  nickname: '',
  pendingAccount: '',
  pendingHunterCode: '',
  pools: [],
  records: new Map(),
  editingPoolKey: null,
}

const $ = (id) => document.getElementById(id)
const els = {
  authView: $('authView'), recordView: $('recordView'), loginForm: $('loginForm'), registerForm: $('registerForm'),
  accountInput: $('accountInput'), hunterCodeInput: $('hunterCodeInput'), nicknameInput: $('nicknameInput'),
  loginButton: $('loginButton'), registerButton: $('registerButton'), loginMessage: $('loginMessage'), registerMessage: $('registerMessage'),
  registerAccountPreview: $('registerAccountPreview'), backToLoginButton: $('backToLoginButton'), nicknameDisplay: $('nicknameDisplay'),
  logoutButton: $('logoutButton'), recordedPoolCount: $('recordedPoolCount'), totalPoolCount: $('totalPoolCount'), totalPulls: $('totalPulls'),
  totalAmount: $('totalAmount'), averagePulls: $('averagePulls'), searchInput: $('searchInput'), yearFilter: $('yearFilter'),
  characterFilter: $('characterFilter'), typeFilter: $('typeFilter'), recordFilter: $('recordFilter'), poolGrid: $('poolGrid'),
  emptyState: $('emptyState'), listSummary: $('listSummary'), editorModal: $('editorModal'), closeModalButton: $('closeModalButton'),
  editorImage: $('editorImage'), editorMeta: $('editorMeta'), editorTitle: $('editorTitle'), editorCharacters: $('editorCharacters'), cardRankList: $('cardRankList'),
  recordForm: $('recordForm'), pullCountInput: $('pullCountInput'), amountInput: $('amountInput'), luckPreview: $('luckPreview'),
  deleteRecordButton: $('deleteRecordButton'), saveRecordButton: $('saveRecordButton'), recordMessage: $('recordMessage'), toast: $('toast'),
}

const TYPE_LABELS = { single: '月卡', multi: '混池', daily: '日卡' }
const RANK_LABELS = ['0階', '1階', '2階', '疊滿']

function formatMoney(value) { return Number(value || 0).toLocaleString('zh-TW') }
function formatDate(value) { if (!value) return ''; const [y,m,d] = String(value).split('-'); return `${y}/${m}/${d}` }
function getYear(pool) { return String(pool.startDate || '').slice(0, 4) }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char])
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  let data = null
  try { data = await response.json() } catch { data = null }
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed: ${response.status}`)
    error.status = response.status
    error.code = data?.error
    throw error
  }
  return data
}

function setButtonLoading(button, loading, loadingText = '處理中…') {
  if (!button) return
  if (loading) {
    button.dataset.originalText = button.textContent
    button.textContent = loadingText
    button.disabled = true
  } else {
    button.textContent = button.dataset.originalText || button.textContent
    button.disabled = false
  }
}

function showToast(message) {
  els.toast.textContent = message
  els.toast.classList.add('show')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200)
}

function sanitizeAccountInput(event) {
  event.target.value = event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 50)
}
function sanitizeDigits(event) { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 5) }
function sanitizeNickname(event) {
  if (event.isComposing) return
  event.target.value = [...event.target.value].filter((char) => /[\u3400-\u4DBF\u4E00-\u9FFF]/u.test(char)).join('').slice(0, 20)
}
function sanitizePositiveInteger(event) {
  const cleaned = String(event.target.value).replace(/\D/g, '')
  event.target.value = cleaned.replace(/^0+(?=\d)/, '')
}

async function restoreSession() {
  try {
    const session = await api('/api/record/session')
    if (session?.authenticated) {
      state.nickname = session.nickname || '獵人'
      await enterRecordView()
      return
    }
  } catch (error) {
    console.warn('session check failed', error)
  }
  showAuthView()
}

function showAuthView() {
  els.authView.classList.remove('hidden')
  els.recordView.classList.add('hidden')
  els.loginForm.classList.remove('hidden')
  els.registerForm.classList.add('hidden')
}

async function handleLogin(event) {
  event.preventDefault()
  els.loginMessage.textContent = ''
  const account = els.accountInput.value.trim()
  const hunterCode = els.hunterCodeInput.value.trim()
  if (!/^[A-Za-z0-9]{1,50}$/.test(account)) return void (els.loginMessage.textContent = '帳號僅限英文字母與數字。')
  if (!/^\d{5}$/.test(hunterCode)) return void (els.loginMessage.textContent = '獵人編號請輸入後 5 碼。')

  setButtonLoading(els.loginButton, true, '登入中…')
  try {
    const result = await api('/api/record/login', { method: 'POST', body: JSON.stringify({ account, hunterCode }) })
    if (result.status === 'NEW_ACCOUNT') {
      state.pendingAccount = account
      state.pendingHunterCode = hunterCode
      els.registerAccountPreview.textContent = account
      els.loginForm.classList.add('hidden')
      els.registerForm.classList.remove('hidden')
      els.nicknameInput.focus()
      return
    }
    state.nickname = result.nickname || '獵人'
    await enterRecordView()
  } catch (error) {
    els.loginMessage.textContent = error.message || '登入失敗。'
  } finally {
    setButtonLoading(els.loginButton, false)
  }
}

async function handleRegister(event) {
  event.preventDefault()
  els.registerMessage.textContent = ''
  const nickname = els.nicknameInput.value.trim()
  if (!/^[\u3400-\u4DBF\u4E00-\u9FFF]{1,20}$/u.test(nickname)) {
    els.registerMessage.textContent = '暱稱只能輸入中文，最多 20 個字。'
    return
  }
  setButtonLoading(els.registerButton, true, '建立中…')
  try {
    const result = await api('/api/record/register', {
      method: 'POST',
      body: JSON.stringify({ account: state.pendingAccount, hunterCode: state.pendingHunterCode, nickname }),
    })
    state.nickname = result.nickname || nickname
    state.pendingAccount = ''
    state.pendingHunterCode = ''
    await enterRecordView()
  } catch (error) {
    els.registerMessage.textContent = error.message || '建立帳號失敗。'
  } finally {
    setButtonLoading(els.registerButton, false)
  }
}

async function enterRecordView() {
  els.authView.classList.add('hidden')
  els.recordView.classList.remove('hidden')
  els.nicknameDisplay.textContent = state.nickname
  els.listSummary.textContent = '讀取卡池中…'
  try {
    const [pools, records] = await Promise.all([api('/api/record/pools'), api('/api/record/records')])
    state.pools = Array.isArray(pools) ? pools : []
    state.records = new Map((Array.isArray(records) ? records : []).map((record) => [record.pool_key, record]))
    buildFilters()
    renderAll()
  } catch (error) {
    if (error.status === 401) {
      showAuthView()
      els.loginMessage.textContent = '登入已失效，請重新登入。'
      return
    }
    els.listSummary.textContent = '資料讀取失敗'
    els.poolGrid.innerHTML = `<div class="empty-state glass-card">${escapeHtml(error.message || '資料讀取失敗，請稍後重試。')}</div>`
  }
}

function buildFilters() {
  const years = [...new Set(state.pools.map(getYear).filter(Boolean))].sort((a,b) => b.localeCompare(a))
  const characters = [...new Set(state.pools.flatMap((pool) => pool.characters || []).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'zh-Hant'))
  els.yearFilter.innerHTML = '<option value="all">全部年份</option>' + years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)} 年</option>`).join('')
  els.characterFilter.innerHTML = '<option value="all">全部角色</option>' + characters.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')
}

function getFilteredPools() {
  const keyword = els.searchInput.value.trim().toLowerCase()
  const year = els.yearFilter.value
  const character = els.characterFilter.value
  const type = els.typeFilter.value
  const recordStatus = els.recordFilter.value

  return state.pools.filter((pool) => {
    const hasRecord = state.records.has(pool.poolKey)
    if (keyword) {
      const haystack = [pool.name, ...(pool.characters || [])].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (year !== 'all' && getYear(pool) !== year) return false
    if (character !== 'all' && !(pool.characters || []).includes(character)) return false
    if (type !== 'all' && pool.poolType !== type) return false
    if (recordStatus === 'recorded' && !hasRecord) return false
    if (recordStatus === 'unrecorded' && hasRecord) return false
    return true
  })
}

function getAcquiredCopies(record) {
  return (Array.isArray(record?.cards) ? record.cards : []).reduce((sum, card) => {
    const rank = Number(card?.rank)
    return Number.isInteger(rank) && rank >= 0 && rank <= 3 ? sum + rank + 1 : sum
  }, 0)
}

function getLuck(record) {
  if (!record || Number(record.pull_count) <= 0) return null
  const copies = getAcquiredCopies(record)
  if (!copies) return null
  const avg = Number(record.pull_count) / copies
  let label = '普通發揮', tone = 'normal'
  if (avg <= 40) { label = '超歐 ✦'; tone = 'lucky' }
  else if (avg <= 60) { label = '偏歐'; tone = 'lucky' }
  else if (avg <= 85) { label = '普通發揮'; tone = 'normal' }
  else if (avg <= 110) { label = '偏非'; tone = 'unlucky' }
  else { label = '很有故事…'; tone = 'unlucky' }
  return { label, tone, average: avg, copies }
}

function getPoolCards(pool) {
  const cards = Array.isArray(pool?.cards) ? pool.cards : []
  return cards.length ? cards : [{ cardKey: 'card:0', cardIndex: 0, label: pool?.characters?.[0] || '卡片 1', imageUrl: pool?.images?.[0] || '' }]
}

function getSavedRank(record, cardKey) {
  const card = (record?.cards || []).find((item) => item.card_key === cardKey || item.cardKey === cardKey)
  return card && Number.isInteger(Number(card.rank)) ? Number(card.rank) : null
}

function renderStats() {
  // 統計只計算目前篩選結果中的卡池。
  // 因此年份、角色、卡池類型、紀錄狀態與關鍵字變更時，
  // 上方總抽數／總課金／平均抽數都會同步更新。
  const filteredPools = getFilteredPools()
  const filteredPoolKeys = new Set(filteredPools.map((pool) => pool.poolKey))
  const records = [...state.records.values()].filter((record) => filteredPoolKeys.has(record.pool_key))

  const totalPulls = records.reduce((sum, record) => sum + Number(record.pull_count || 0), 0)
  const totalAmount = records.reduce((sum, record) => sum + Number(record.amount_twd || 0), 0)
  const totalCopies = records.reduce((sum, record) => sum + getAcquiredCopies(record), 0)

  els.recordedPoolCount.textContent = records.length.toLocaleString('zh-TW')
  els.totalPoolCount.textContent = filteredPools.length.toLocaleString('zh-TW')
  els.totalPulls.textContent = totalPulls.toLocaleString('zh-TW')
  els.totalAmount.textContent = formatMoney(totalAmount)
  els.averagePulls.textContent = totalCopies
    ? Math.round(totalPulls / totalCopies).toLocaleString('zh-TW')
    : '0'
}

function poolCard(pool) {
  const record = state.records.get(pool.poolKey)
  const image = pool.images?.[0]
  const luck = getLuck(record)
  const chars = (pool.characters || []).join('、') || '—'
  return `
    <article class="pool-card" data-pool-key="${escapeHtml(pool.poolKey)}">
      <div class="pool-cover" data-open-editor="${escapeHtml(pool.poolKey)}">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(pool.name)}" loading="lazy" referrerpolicy="no-referrer" />` : '<div class="pool-placeholder">✦</div>'}
        <label class="record-check" title="勾選代表我要紀錄這個卡池">
          <input type="checkbox" data-pool-check="${escapeHtml(pool.poolKey)}" ${record ? 'checked' : ''} />
          <span>${record ? '已紀錄' : '我有抽'}</span>
        </label>
      </div>
      <div class="pool-body">
        <div class="pool-badges">
          <span class="badge">${escapeHtml(TYPE_LABELS[pool.poolType] || '卡池')}</span>
          ${pool.isRerun ? '<span class="badge rerun">復刻</span>' : ''}
        </div>
        <h3 class="pool-name" data-open-editor="${escapeHtml(pool.poolKey)}">${escapeHtml(pool.name)}</h3>
        <div class="pool-date">${escapeHtml(formatDate(pool.startDate))} ～ ${escapeHtml(formatDate(pool.endDate))}</div>
        <div class="pool-characters">${escapeHtml(chars)}</div>
        ${record ? `
          <div class="record-summary" data-open-editor="${escapeHtml(pool.poolKey)}">
            <strong>${getAcquiredCopies(record)} 張 · ${Number(record.pull_count || 0).toLocaleString('zh-TW')} 抽 · NT$ ${formatMoney(record.amount_twd)}</strong>
            ${luck ? `<span class="luck-pill ${luck.tone === 'unlucky' ? 'unlucky' : ''}">${escapeHtml(luck.label)}｜平均 ${Math.round(luck.average)} 抽/張</span>` : '<span>尚未勾選取得卡片或抽數</span>'}
          </div>` : `
          <div class="record-summary unrecorded" data-open-editor="${escapeHtml(pool.poolKey)}">＋ 新增這個卡池的紀錄</div>`}
      </div>
    </article>`
}

function renderPools() {
  const pools = getFilteredPools()
  els.poolGrid.innerHTML = pools.map(poolCard).join('')
  els.emptyState.classList.toggle('hidden', pools.length > 0)
  els.listSummary.textContent = `顯示 ${pools.length} / ${state.pools.length} 個卡池`
}

function renderAll() { renderStats(); renderPools() }

function openEditor(poolKey) {
  const pool = state.pools.find((item) => item.poolKey === poolKey)
  if (!pool) return
  state.editingPoolKey = poolKey
  const record = state.records.get(poolKey)
  els.editorTitle.textContent = pool.name
  els.editorMeta.textContent = `${getYear(pool)} · ${TYPE_LABELS[pool.poolType] || '卡池'} · ${formatDate(pool.startDate)} ～ ${formatDate(pool.endDate)}`
  const cardNames = getPoolCards(pool)
    .map((card) => String(card?.label || '').trim())
    .filter(Boolean)
  els.editorCharacters.textContent = cardNames.length
    ? cardNames.map((name) => `「${name}」`).join('、')
    : ((pool.characters || []).join('、') || '卡片資料未設定')
  const image = pool.images?.[0]
  els.editorImage.style.backgroundImage = image ? `url("${String(image).replace(/"/g, '\\"')}")` : ''
  els.editorImage.classList.toggle('no-image', !image)
  const cards = getPoolCards(pool)
  els.cardRankList.innerHTML = cards.map((card) => {
    const savedRank = getSavedRank(record, card.cardKey)
    const image = card.imageUrl || ''
    const label = card.label || `卡片 ${Number(card.cardIndex || 0) + 1}`
    const options = [{ value: '', label: '未取得' }, ...RANK_LABELS.map((text, rank) => ({ value: String(rank), label: text }))]
    return `
      <article class="card-rank-item" data-card-key="${escapeHtml(card.cardKey)}" data-card-index="${Number(card.cardIndex || 0)}" data-card-label="${escapeHtml(label)}" data-card-image="${escapeHtml(image)}">
        <div class="card-rank-thumb">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(label)}" loading="lazy" referrerpolicy="no-referrer" />` : '<span>✦</span>'}</div>
        <div class="card-rank-info">
          <strong>${escapeHtml(label)}</strong>
          <div class="rank-options rank-options-five">
            ${options.map((option) => `<label><input type="radio" name="rank-${Number(card.cardIndex || 0)}" value="${option.value}" ${String(savedRank ?? '') === option.value ? 'checked' : ''} /><span>${option.label}</span></label>`).join('')}
          </div>
        </div>
      </article>`
  }).join('')
  els.pullCountInput.value = record?.pull_count ?? ''
  els.amountInput.value = record?.amount_twd ?? ''
  els.deleteRecordButton.classList.toggle('hidden', !record)
  els.recordMessage.textContent = ''
  updateLuckPreview()
  els.editorModal.classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

function closeEditor() {
  els.editorModal.classList.add('hidden')
  document.body.style.overflow = ''
  state.editingPoolKey = null
}

function collectEditorCards() {
  return [...els.cardRankList.querySelectorAll('.card-rank-item')].flatMap((item) => {
    const selected = item.querySelector('input[type="radio"]:checked')
    if (!selected || selected.value === '') return []
    return [{
      cardKey: item.dataset.cardKey,
      cardIndex: Number(item.dataset.cardIndex || 0),
      cardLabel: item.dataset.cardLabel || '',
      imageUrl: item.dataset.cardImage || '',
      rank: Number(selected.value),
    }]
  })
}

function updateLuckPreview() {
  const pulls = Number(els.pullCountInput.value || 0)
  const cards = collectEditorCards()
  const copies = cards.reduce((sum, card) => sum + Number(card.rank) + 1, 0)
  if (!pulls || !copies) {
    els.luckPreview.innerHTML = '<span>簡易運氣評估</span><strong>勾選取得卡片並輸入抽數後就會幫你算 ✦</strong><small>0階=1張、1階=2張、2階=3張、疊滿=4張；日卡與混池會把各張卡分開加總。</small>'
    return
  }
  const luck = getLuck({ pull_count: pulls, cards })
  els.luckPreview.innerHTML = `<span>簡易運氣評估</span><strong>${escapeHtml(luck.label)}｜${copies} 張，平均 ${Math.round(luck.average)} 抽 / 張</strong><small>平均抽數 = 此卡池總抽數 ÷ 實際取得的五星卡總張數。</small>`
}

async function saveRecord(event) {
  event.preventDefault()
  const poolKey = state.editingPoolKey
  if (!poolKey) return
  const cards = collectEditorCards()
  const pullCount = Number(els.pullCountInput.value)
  const amountTwd = Number(els.amountInput.value)
  if (!Number.isInteger(pullCount) || pullCount < 0) return void (els.recordMessage.textContent = '抽數只能輸入 0 以上的整數。')
  if (!Number.isInteger(amountTwd) || amountTwd < 0) return void (els.recordMessage.textContent = '課金金額只能輸入 0 以上的整數。')

  setButtonLoading(els.saveRecordButton, true, '儲存中…')
  els.recordMessage.textContent = ''
  try {
    const saved = await api('/api/record/records', { method: 'PUT', body: JSON.stringify({ poolKey, cards, pullCount, amountTwd }) })
    state.records.set(poolKey, {
      ...saved,
      pool_key: saved.pool_key || poolKey,
      cards: Array.isArray(saved.cards) ? saved.cards : cards.map((card) => ({ card_key: card.cardKey, card_index: card.cardIndex, card_label: card.cardLabel, image_url: card.imageUrl, rank: card.rank })),
      pull_count: Number(saved.pull_count ?? pullCount),
      amount_twd: Number(saved.amount_twd ?? amountTwd),
    })
    renderAll()
    closeEditor()
    showToast('紀錄已儲存 ✦')
  } catch (error) {
    els.recordMessage.textContent = error.message || '儲存失敗。'
  } finally {
    setButtonLoading(els.saveRecordButton, false)
  }
}

async function deleteRecord(poolKey = state.editingPoolKey) {
  if (!poolKey || !state.records.has(poolKey)) return
  if (!window.confirm('確定要刪除這個卡池的抽卡紀錄嗎？')) return
  try {
    await api('/api/record/records', { method: 'DELETE', body: JSON.stringify({ poolKey }) })
    state.records.delete(poolKey)
    renderAll()
    closeEditor()
    showToast('紀錄已刪除')
  } catch (error) {
    els.recordMessage.textContent = error.message || '刪除失敗。'
  }
}

async function handleLogout() {
  try { await api('/api/record/logout', { method: 'POST' }) } catch {}
  state.nickname = ''
  state.pools = []
  state.records.clear()
  els.accountInput.value = ''
  els.hunterCodeInput.value = ''
  els.nicknameInput.value = ''
  showAuthView()
}

els.accountInput.addEventListener('input', sanitizeAccountInput)
els.hunterCodeInput.addEventListener('input', sanitizeDigits)
els.nicknameInput.addEventListener('input', sanitizeNickname)
els.nicknameInput.addEventListener('compositionend', sanitizeNickname)
els.pullCountInput.addEventListener('input', (event) => { sanitizePositiveInteger(event); updateLuckPreview() })
els.amountInput.addEventListener('input', sanitizePositiveInteger)
els.recordForm.addEventListener('change', (event) => { if (event.target.matches('.card-rank-item input[type="radio"]')) updateLuckPreview() })
els.loginForm.addEventListener('submit', handleLogin)
els.registerForm.addEventListener('submit', handleRegister)
els.recordForm.addEventListener('submit', saveRecord)
els.backToLoginButton.addEventListener('click', () => {
  els.registerForm.classList.add('hidden'); els.loginForm.classList.remove('hidden');
  state.pendingAccount = ''; state.pendingHunterCode = ''; els.nicknameInput.value = '';
})
els.logoutButton.addEventListener('click', handleLogout)
els.closeModalButton.addEventListener('click', closeEditor)
els.deleteRecordButton.addEventListener('click', () => deleteRecord())
els.editorModal.addEventListener('click', (event) => { if (event.target === els.editorModal) closeEditor() })
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !els.editorModal.classList.contains('hidden')) closeEditor() })

for (const el of [els.searchInput, els.yearFilter, els.characterFilter, els.typeFilter, els.recordFilter]) {
  el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderAll)
}

els.poolGrid.addEventListener('click', async (event) => {
  const checkbox = event.target.closest('[data-pool-check]')
  if (checkbox) {
    const poolKey = checkbox.dataset.poolCheck
    const hasRecord = state.records.has(poolKey)
    if (hasRecord && !checkbox.checked) {
      checkbox.checked = true
      await deleteRecord(poolKey)
    } else if (!hasRecord && checkbox.checked) {
      checkbox.checked = false
      openEditor(poolKey)
    }
    return
  }
  const opener = event.target.closest('[data-open-editor]')
  if (opener) openEditor(opener.dataset.openEditor)
})

restoreSession()
