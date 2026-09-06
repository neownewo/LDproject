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
            <p>目前第一階段先管理卡池；舊 Google Sheet 資料維持唯讀並繼續在公開頁顯示。</p>
          </div>
          <div class="header-actions">
            <router-link to="/gacha" class="ghost-link">查看公開頁</router-link>
            <button class="logout-btn" @click="logout">登出</button>
          </div>
        </header>

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
                <div class="chips"><span>{{ typeLabel(pool.pool_type) }}</span><span v-if="pool.is_rerun">復刻</span><span :class="pool.is_published ? 'published' : 'draft'">{{ pool.is_published ? '已公開' : '草稿' }}</span></div>
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
const password = ref('')
const errorMessage = ref('')
const pools = ref([])
const editingPool = ref(null)
const keyword = ref('')
const toast = ref('')

const publishedCount = computed(() => pools.value.filter((pool) => pool.is_published).length)
const filteredPools = computed(() => {
  const q = keyword.value.toLowerCase()
  return pools.value.filter((pool) => !q || `${pool.name} ${(pool.characters || []).join(' ')}`.toLowerCase().includes(q))
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

function showToast(text) {
  toast.value = text
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => { toast.value = '' }, 2800)
}
</script>

<style scoped>
.admin-shell{min-height:100vh;background:radial-gradient(circle at 10% 0%,rgba(215,213,255,.48),transparent 35%),linear-gradient(#f8f9fd,#f5f6fb);color:#151923}.admin-wrap{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:34px 0 70px}.center-card,.login-card,.list-card,.admin-header,.metric{border:1px solid rgba(220,224,233,.95);background:rgba(255,255,255,.94);box-shadow:0 18px 42px rgba(31,41,55,.07)}.center-card{border-radius:22px;padding:30px;text-align:center}.login-card{width:min(430px,100%);box-sizing:border-box;margin:10vh auto;border-radius:26px;padding:30px}.eyebrow{margin:0 0 7px;color:#7775d8;font-size:11px;font-weight:900;letter-spacing:.14em}.login-card h1,.admin-header h1{margin:0;font-size:34px}.login-card p,.admin-header p{color:#6f7582;line-height:1.7}.login-card form{display:grid;gap:10px;margin-top:20px}.login-card input,.list-head input{border:1px solid #d9dde6;border-radius:14px;padding:11px 13px;outline:none}.login-card button{border:0;border-radius:999px;padding:11px;background:linear-gradient(135deg,#7775d8,#a58be7);color:#fff;font-weight:900;cursor:pointer}.error-text{color:#b52f47!important}.admin-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-radius:26px;padding:24px;margin-bottom:16px}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.ghost-link,.logout-btn,.row-actions button{border:1px solid #d9dde6;border-radius:999px;padding:8px 12px;background:#fff;color:#555b68;font-weight:850;text-decoration:none;cursor:pointer}.dashboard-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}.metric{border-radius:18px;padding:16px}.metric span{display:block;color:#777d89;font-size:12px}.metric strong{font-size:27px}.list-card{margin-top:16px;border-radius:24px;padding:20px}.list-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.list-head h2{margin:0}.pool-list{display:grid;gap:9px}.pool-row{display:grid;grid-template-columns:74px 1fr auto;gap:12px;align-items:center;border:1px solid #e6e8ee;border-radius:17px;padding:9px;background:#fff}.pool-row img,.thumb-empty{width:74px;height:74px;border-radius:12px;object-fit:contain;background:#f4f5fa}.thumb-empty{display:grid;place-items:center;color:#a4a8b1;font-size:10px}.pool-info h3{margin:5px 0 3px;font-size:15px}.pool-info p{margin:0;color:#7b8190;font-size:12px}.chips{display:flex;gap:5px;flex-wrap:wrap}.chips span{border-radius:999px;padding:2px 7px;background:#f0efff;color:#6966c8;font-size:10px;font-weight:900}.chips .published{background:#ebfaf4;color:#118361}.chips .draft{background:#f3f4f6;color:#777}.row-actions{display:flex;gap:5px}.row-actions button{font-size:11px}.row-actions .danger{color:#b42d47;border-color:#f0ccd3}.empty-state{border:1px dashed #d8dbe4;border-radius:15px;padding:22px;text-align:center;color:#7d828d}.toast{position:fixed;right:20px;bottom:20px;border-radius:14px;padding:11px 16px;background:#222634;color:#fff;box-shadow:0 14px 30px rgba(0,0,0,.18);z-index:100}@media(max-width:760px){.admin-header,.list-head{display:grid}.dashboard-grid{grid-template-columns:1fr 1fr 1fr}.pool-row{grid-template-columns:58px 1fr}.pool-row img,.thumb-empty{width:58px;height:58px}.row-actions{grid-column:1/-1;justify-content:flex-end}.admin-wrap{width:min(100% - 20px,1180px);padding-top:16px}}
</style>
