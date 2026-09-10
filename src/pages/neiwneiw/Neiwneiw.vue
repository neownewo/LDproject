<template>
  <div class="admin-shell">
    <main class="admin-wrap">
      <section v-if="checking" class="center-card">後台驗證中…</section>

      <section v-else-if="!authenticated" class="login-card">
        <p class="eyebrow">NEIWNEIW</p>
        <h1>控制室</h1>
        <p>這個入口不會出現在公開導覽列。輸入你設定在 Vercel 的後台密碼即可。</p>
        <form @submit.prevent="login">
          <input v-model="password" type="password" autocomplete="current-password" placeholder="後台密碼" required />
          <button type="submit" :disabled="working">{{ working ? '登入中…' : '登入' }}</button>
        </form>
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </section>

      <template v-else>
        <header class="admin-header">
          <div>
            <p class="eyebrow">NEIWNEIW CONTROL ROOM</p>
            <h1>網站後台</h1>
            <p>卡池維護與抽卡紀錄器統計集中在這裡管理。</p>
          </div>
          <div class="header-actions">
            <router-link to="/gacha" class="ghost-link">查看公開頁</router-link>
            <a href="/record" target="_blank" rel="noopener" class="ghost-link">查看紀錄器</a>
            <button class="logout-btn" @click="logout">登出</button>
          </div>
        </header>

        <nav class="admin-tabs" aria-label="後台功能">
          <button :class="{ active: activeSection === 'gacha' }" @click="switchSection('gacha')">卡池管理</button>
          <button :class="{ active: activeSection === 'records' }" @click="switchSection('records')">抽卡紀錄器管理</button>
        </nav>

        <template v-if="activeSection === 'gacha'">
          <section class="dashboard-grid">
            <div class="metric"><span>後台卡池</span><strong>{{ pools.length }}</strong></div>
            <div class="metric"><span>已公開</span><strong>{{ publishedCount }}</strong></div>
            <div class="metric"><span>草稿</span><strong>{{ pools.length - publishedCount }}</strong></div>
          </section>

          <GachaEditor :value="editingPool" :saving="saving" @save="savePool" @cancel="cancelEdit" />

          <section class="list-card">
            <div class="list-head">
              <div>
                <p class="eyebrow">SUPABASE DATA</p>
                <h2>新卡池資料</h2>
              </div>
              <input v-model.trim="keyword" type="search" placeholder="搜尋卡池名稱" />
            </div>

            <div v-if="loadingPools" class="empty-state">資料載入中…</div>
            <div v-else-if="!filteredPools.length" class="empty-state">目前沒有後台建立的卡池。</div>
            <div v-else class="pool-list">
              <article v-for="pool in filteredPools" :key="pool.id" class="pool-row">
                <img v-if="pool.image_urls?.[0]" :src="pool.image_urls[0]" :alt="pool.name" />
                <div v-else class="thumb-empty">NO IMG</div>
                <div class="pool-info">
                  <div class="chips">
                    <span>{{ typeLabel(pool.pool_type) }}</span>
                    <span v-if="pool.is_rerun">復刻</span>
                    <span :class="pool.is_published ? 'published' : 'draft'">{{ pool.is_published ? '已公開' : '草稿' }}</span>
                  </div>
                  <h3>{{ pool.name }}</h3>
                  <p>{{ pool.start_date }} ～ {{ pool.end_date }} · {{ (pool.characters || []).join('、') || '未指定角色' }}</p>
                </div>
                <div class="row-actions">
                  <button @click="edit(pool)">編輯</button>
                  <button @click="duplicate(pool)">複製</button>
                  <button class="danger" @click="remove(pool)">刪除</button>
                </div>
              </article>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="record-toolbar list-card">
            <div>
              <p class="eyebrow">GACHA RECORD ANALYTICS</p>
              <h2>抽卡紀錄器管理</h2>
              <p>只在後台顯示帳號與統計資料；不顯示獵人編號雜湊值。</p>
            </div>
            <button class="refresh-btn" :disabled="loadingRecords" @click="loadRecordAnalytics">
              {{ loadingRecords ? '讀取中…' : '重新整理數據' }}
            </button>
          </section>

          <div v-if="loadingRecords && !recordAnalytics" class="empty-state list-card">抽卡紀錄資料載入中…</div>

          <template v-else-if="recordAnalytics">
            <section class="record-summary-grid">
              <div class="metric"><span>註冊帳號</span><strong>{{ number(recordSummary.accountCount) }}</strong></div>
              <div class="metric"><span>有紀錄帳號</span><strong>{{ number(recordSummary.activeAccountCount) }}</strong></div>
              <div class="metric"><span>紀錄筆數</span><strong>{{ number(recordSummary.recordCount) }}</strong></div>
              <div class="metric"><span>有資料卡池</span><strong>{{ number(recordSummary.poolCount) }}</strong></div>
              <div class="metric"><span>總抽數</span><strong>{{ number(recordSummary.totalPulls) }}</strong></div>
              <div class="metric"><span>總課金</span><strong>NT$ {{ money(recordSummary.totalAmount) }}</strong></div>
              <div class="metric"><span>取得五星張數</span><strong>{{ number(recordSummary.totalCopies) }}</strong></div>
              <div class="metric"><span>平均抽數 / 張</span><strong>{{ decimal(recordSummary.averagePullsPerCopy) }}</strong></div>
            </section>

            <section class="list-card">
              <div class="list-head">
                <div>
                  <p class="eyebrow">ACCOUNTS</p>
                  <h2>帳號資料</h2>
                </div>
                <input v-model.trim="accountKeyword" type="search" placeholder="搜尋帳號或暱稱" />
              </div>

              <div v-if="!filteredRecordUsers.length" class="empty-state">沒有符合條件的帳號。</div>
              <div v-else class="table-scroll">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>暱稱</th>
                      <th>帳號</th>
                      <th>建立時間</th>
                      <th>最後登入</th>
                      <th class="num">紀錄池數</th>
                      <th class="num">總抽數</th>
                      <th class="num">總課金</th>
                      <th class="num">平均抽數 / 張</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in filteredRecordUsers" :key="user.id">
                      <td><strong>{{ user.nickname || '—' }}</strong></td>
                      <td class="mono">{{ user.account || '—' }}</td>
                      <td>{{ dateTime(user.createdAt) }}</td>
                      <td>{{ dateTime(user.lastLoginAt) }}</td>
                      <td class="num">{{ number(user.recordCount) }}</td>
                      <td class="num">{{ number(user.totalPulls) }}</td>
                      <td class="num">NT$ {{ money(user.totalAmount) }}</td>
                      <td class="num">{{ decimal(user.averagePullsPerCopy) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="list-card">
              <div class="list-head analytics-head">
                <div>
                  <p class="eyebrow">POOL ANALYTICS</p>
                  <h2>各卡池統計</h2>
                </div>
                <input v-model.trim="recordKeyword" type="search" placeholder="搜尋卡池、角色" />
              </div>

              <div v-if="!filteredRecordPools.length" class="empty-state">目前沒有符合條件的卡池紀錄。</div>
              <div v-else class="analytics-list">
                <article v-for="pool in filteredRecordPools" :key="pool.poolKey" class="analytics-card">
                  <div class="analytics-title">
                    <div>
                      <div class="chips">
                        <span v-if="pool.poolType">{{ typeLabel(pool.poolType) }}</span>
                        <span>{{ number(pool.participantCount) }} 人紀錄</span>
                      </div>
                      <h3>{{ pool.name }}</h3>
                      <p>{{ pool.startDate || '日期未取得' }}<template v-if="pool.characters?.length"> · {{ pool.characters.join('、') }}</template></p>
                    </div>
                    <div class="analytics-total">
                      <span>總抽數 {{ number(pool.totalPulls) }}</span>
                      <strong>NT$ {{ money(pool.totalAmount) }}</strong>
                    </div>
                  </div>

                  <div class="pool-stat-grid">
                    <div><span>人均抽數</span><strong>{{ decimal(pool.averagePullsPerPerson) }}</strong></div>
                    <div><span>人均課金</span><strong>NT$ {{ money(pool.averageAmountPerPerson) }}</strong></div>
                    <div><span>平均抽數 / 張</span><strong>{{ decimal(pool.averagePullsPerCopy) }}</strong></div>
                    <div><span>五星取得數</span><strong>{{ number(pool.totalCopies) }} 張</strong></div>
                  </div>

                  <div class="extreme-grid">
                    <div class="extreme lucky">
                      <span>最歐洲 ✦</span>
                      <strong>{{ pool.mostLucky ? `${decimal(pool.mostLucky.pullsPerCopy)} 抽 / 張` : '—' }}</strong>
                      <small v-if="pool.mostLucky">{{ pool.mostLucky.nickname }} · {{ number(pool.mostLucky.pulls) }} 抽 / {{ number(pool.mostLucky.copies) }} 張</small>
                    </div>
                    <div class="extreme unlucky">
                      <span>最非洲</span>
                      <strong>{{ pool.mostUnlucky ? `${decimal(pool.mostUnlucky.pullsPerCopy)} 抽 / 張` : '—' }}</strong>
                      <small v-if="pool.mostUnlucky">{{ pool.mostUnlucky.nickname }} · {{ number(pool.mostUnlucky.pulls) }} 抽 / {{ number(pool.mostUnlucky.copies) }} 張</small>
                    </div>
                    <div class="extreme">
                      <span>課金最高</span>
                      <strong>{{ pool.highestSpend ? `NT$ ${money(pool.highestSpend.amount)}` : '—' }}</strong>
                      <small v-if="pool.highestSpend">{{ pool.highestSpend.nickname }}</small>
                    </div>
                    <div class="extreme">
                      <span>課金最低</span>
                      <strong>{{ pool.lowestSpend ? `NT$ ${money(pool.lowestSpend.amount)}` : '—' }}</strong>
                      <small v-if="pool.lowestSpend">{{ pool.lowestSpend.nickname }}</small>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </template>

          <div v-else class="empty-state list-card">抽卡紀錄資料讀取失敗，請重新整理。</div>
        </template>

        <p v-if="toast" class="toast">{{ toast }}</p>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import GachaEditor from '../../components/neiwneiw/GachaEditor.vue'
import { POOL_TYPE_LABELS } from '../../constants/gacha'
import {
  createAdminGachaPool,
  deleteAdminGachaPool,
  fetchAdminGachaPools,
  fetchAdminRecordAnalytics,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  updateAdminGachaPool,
} from '../../services/adminService'

const checking = ref(true)
const authenticated = ref(false)
const working = ref(false)
const saving = ref(false)
const loadingPools = ref(false)
const loadingRecords = ref(false)
const password = ref('')
const errorMessage = ref('')
const pools = ref([])
const editingPool = ref(null)
const keyword = ref('')
const toast = ref('')
const activeSection = ref('gacha')
const recordAnalytics = ref(null)
const accountKeyword = ref('')
const recordKeyword = ref('')

const publishedCount = computed(() => pools.value.filter((pool) => pool.is_published).length)
const filteredPools = computed(() => {
  const q = keyword.value.toLowerCase()
  return pools.value.filter((pool) => !q || `${pool.name} ${(pool.characters || []).join(' ')}`.toLowerCase().includes(q))
})
const recordSummary = computed(() => recordAnalytics.value?.summary || {})
const filteredRecordUsers = computed(() => {
  const q = accountKeyword.value.toLowerCase()
  const rows = recordAnalytics.value?.users || []
  return rows.filter((user) => !q || `${user.account || ''} ${user.nickname || ''}`.toLowerCase().includes(q))
})
const filteredRecordPools = computed(() => {
  const q = recordKeyword.value.toLowerCase()
  const rows = recordAnalytics.value?.pools || []
  return rows.filter((pool) => !q || `${pool.name || ''} ${(pool.characters || []).join(' ')}`.toLowerCase().includes(q))
})

onMounted(async () => {
  try {
    const session = await getAdminSession()
    authenticated.value = session.authenticated
    if (authenticated.value) await loadPools()
  } finally {
    checking.value = false
  }
})

async function login() {
  working.value = true
  errorMessage.value = ''
  try {
    await loginAdmin(password.value)
    authenticated.value = true
    password.value = ''
    await loadPools()
  } catch (error) {
    errorMessage.value = error.status === 401 ? '密碼不正確' : '登入失敗，請稍後再試'
  } finally {
    working.value = false
  }
}

async function logout() {
  await logoutAdmin().catch(() => {})
  authenticated.value = false
  pools.value = []
  editingPool.value = null
  recordAnalytics.value = null
  activeSection.value = 'gacha'
}

async function switchSection(section) {
  activeSection.value = section
  if (section === 'records' && !recordAnalytics.value) await loadRecordAnalytics()
}

async function loadPools() {
  loadingPools.value = true
  try {
    pools.value = await fetchAdminGachaPools()
  } catch (error) {
    if (error.status === 401) authenticated.value = false
    else showToast('卡池資料讀取失敗')
  } finally {
    loadingPools.value = false
  }
}

async function loadRecordAnalytics() {
  loadingRecords.value = true
  try {
    recordAnalytics.value = await fetchAdminRecordAnalytics()
  } catch (error) {
    if (error.status === 401) authenticated.value = false
    else showToast(`抽卡紀錄資料讀取失敗：${error.message}`)
  } finally {
    loadingRecords.value = false
  }
}

function toPayload(model) {
  const { id, ...payload } = model
  return payload
}

async function savePool(model) {
  saving.value = true
  try {
    if (model.id) await updateAdminGachaPool(model.id, toPayload(model))
    else await createAdminGachaPool(toPayload(model))
    editingPool.value = null
    await loadPools()
    showToast(model.id ? '卡池已更新' : '卡池已建立')
  } catch (error) {
    showToast(`儲存失敗：${error.message}`)
  } finally {
    saving.value = false
  }
}

function edit(pool) {
  editingPool.value = JSON.parse(JSON.stringify(pool))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function duplicate(pool) {
  const copy = JSON.parse(JSON.stringify(pool))
  copy.id = ''
  copy.name = `${copy.name}（複製）`
  copy.is_published = false
  editingPool.value = copy
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function cancelEdit() {
  editingPool.value = null
}

async function remove(pool) {
  if (!window.confirm(`確定刪除「${pool.name}」？對應 Supabase 圖片也會一起刪除。`)) return
  try {
    await deleteAdminGachaPool(pool.id)
    if (editingPool.value?.id === pool.id) editingPool.value = null
    await loadPools()
    showToast('已刪除卡池')
  } catch (error) {
    showToast(`刪除失敗：${error.message}`)
  }
}

function typeLabel(type) {
  return POOL_TYPE_LABELS[type] || type
}

function number(value) {
  return Number(value || 0).toLocaleString('zh-TW')
}

function money(value) {
  return Math.round(Number(value || 0)).toLocaleString('zh-TW')
}

function decimal(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? n.toLocaleString('zh-TW') : n.toLocaleString('zh-TW', { maximumFractionDigits: 1 })
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function showToast(text) {
  toast.value = text
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => { toast.value = '' }, 2800)
}
</script>

<style scoped>
.admin-shell{min-height:100vh;background:radial-gradient(circle at 10% 0%,rgba(215,213,255,.48),transparent 35%),linear-gradient(#f8f9fd,#f5f6fb);color:#151923}.admin-wrap{width:min(1280px,calc(100% - 32px));margin:0 auto;padding:34px 0 70px}.center-card,.login-card,.list-card,.admin-header,.metric{border:1px solid rgba(220,224,233,.95);background:rgba(255,255,255,.94);box-shadow:0 18px 42px rgba(31,41,55,.07)}.center-card{border-radius:22px;padding:30px;text-align:center}.login-card{width:min(430px,100%);box-sizing:border-box;margin:10vh auto;border-radius:26px;padding:30px}.eyebrow{margin:0 0 7px;color:#7775d8;font-size:11px;font-weight:900;letter-spacing:.14em}.login-card h1,.admin-header h1{margin:0;font-size:34px}.login-card p,.admin-header p,.record-toolbar p{color:#6f7582;line-height:1.7}.login-card form{display:grid;gap:10px;margin-top:20px}.login-card input,.list-head input{border:1px solid #d9dde6;border-radius:14px;padding:11px 13px;outline:none}.login-card button{border:0;border-radius:999px;padding:11px;background:linear-gradient(135deg,#7775d8,#a58be7);color:#fff;font-weight:900;cursor:pointer}.error-text{color:#b52f47!important}.admin-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-radius:26px;padding:24px;margin-bottom:12px}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.ghost-link,.logout-btn,.row-actions button,.refresh-btn{border:1px solid #d9dde6;border-radius:999px;padding:8px 12px;background:#fff;color:#555b68;font-weight:850;text-decoration:none;cursor:pointer}.admin-tabs{display:flex;gap:8px;margin:0 0 16px;padding:6px;border:1px solid #e1e4ec;border-radius:18px;background:rgba(255,255,255,.8);width:max-content;max-width:100%;box-sizing:border-box}.admin-tabs button{border:0;border-radius:13px;padding:10px 18px;background:transparent;color:#737988;font-weight:900;cursor:pointer}.admin-tabs button.active{background:#7775d8;color:#fff;box-shadow:0 7px 18px rgba(119,117,216,.22)}.dashboard-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}.record-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.metric{border-radius:18px;padding:16px;min-width:0}.metric span{display:block;color:#777d89;font-size:12px}.metric strong{display:block;margin-top:4px;font-size:25px;overflow-wrap:anywhere}.list-card{margin-top:16px;border-radius:24px;padding:20px}.list-head,.record-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px}.list-head{margin-bottom:14px}.list-head h2,.record-toolbar h2{margin:0}.record-toolbar{margin-top:0}.record-toolbar p{margin-bottom:0}.refresh-btn:disabled{opacity:.55;cursor:wait}.pool-list{display:grid;gap:9px}.pool-row{display:grid;grid-template-columns:74px 1fr auto;gap:12px;align-items:center;border:1px solid #e6e8ee;border-radius:17px;padding:9px;background:#fff}.pool-row img,.thumb-empty{width:74px;height:74px;border-radius:12px;object-fit:contain;background:#f4f5fa}.thumb-empty{display:grid;place-items:center;color:#a4a8b1;font-size:10px}.pool-info h3{margin:5px 0 3px;font-size:15px}.pool-info p,.analytics-title p{margin:0;color:#7b8190;font-size:12px}.chips{display:flex;gap:5px;flex-wrap:wrap}.chips span{border-radius:999px;padding:2px 7px;background:#f0efff;color:#6966c8;font-size:10px;font-weight:900}.chips .published{background:#ebfaf4;color:#118361}.chips .draft{background:#f3f4f6;color:#777}.row-actions{display:flex;gap:5px}.row-actions button{font-size:11px}.row-actions .danger{color:#b42d47;border-color:#f0ccd3}.empty-state{border:1px dashed #d8dbe4;border-radius:15px;padding:22px;text-align:center;color:#7d828d}.table-scroll{overflow:auto;border:1px solid #e7e9ef;border-radius:16px}.admin-table{width:100%;min-width:940px;border-collapse:collapse;background:#fff}.admin-table th,.admin-table td{padding:11px 12px;border-bottom:1px solid #eceef3;text-align:left;white-space:nowrap;font-size:12px}.admin-table th{position:sticky;top:0;background:#f8f9fc;color:#717785;font-size:11px;z-index:1}.admin-table tbody tr:last-child td{border-bottom:0}.admin-table .num{text-align:right}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#606675}.analytics-list{display:grid;gap:12px}.analytics-card{border:1px solid #e5e7ef;border-radius:20px;background:#fff;padding:16px}.analytics-title{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.analytics-title h3{margin:6px 0 4px}.analytics-total{text-align:right;color:#737988;font-size:11px}.analytics-total strong{display:block;margin-top:4px;color:#353947;font-size:17px}.pool-stat-grid,.extreme-grid{display:grid;gap:8px;margin-top:13px}.pool-stat-grid{grid-template-columns:repeat(4,1fr)}.pool-stat-grid>div,.extreme{border-radius:14px;background:#f7f8fb;padding:11px}.pool-stat-grid span,.extreme span{display:block;color:#888d98;font-size:10px;font-weight:800}.pool-stat-grid strong,.extreme strong{display:block;margin-top:3px;font-size:15px}.extreme-grid{grid-template-columns:repeat(4,1fr)}.extreme small{display:block;margin-top:4px;color:#858a96;font-size:10px}.extreme.lucky{background:#f2f0ff}.extreme.lucky strong{color:#6966c8}.extreme.unlucky{background:#fff3f5}.extreme.unlucky strong{color:#ad4155}.toast{position:fixed;right:20px;bottom:20px;border-radius:14px;padding:11px 16px;background:#222634;color:#fff;box-shadow:0 14px 30px rgba(0,0,0,.18);z-index:100}@media(max-width:900px){.record-summary-grid{grid-template-columns:repeat(2,1fr)}.pool-stat-grid,.extreme-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.admin-header,.list-head,.record-toolbar,.analytics-title{display:grid}.dashboard-grid{grid-template-columns:1fr 1fr 1fr}.pool-row{grid-template-columns:58px 1fr}.pool-row img,.thumb-empty{width:58px;height:58px}.row-actions{grid-column:1/-1;justify-content:flex-end}.admin-wrap{width:min(100% - 20px,1280px);padding-top:16px}.analytics-total{text-align:left}.admin-tabs{width:100%}.admin-tabs button{flex:1;padding-inline:10px}}@media(max-width:520px){.dashboard-grid,.record-summary-grid,.pool-stat-grid,.extreme-grid{grid-template-columns:1fr 1fr}.metric strong{font-size:21px}.list-card{padding:15px}}
</style>
