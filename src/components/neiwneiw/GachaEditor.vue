<template>
  <form class="editor-card" @submit.prevent="submit">
    <div class="editor-head">
      <div>
        <p class="eyebrow">GACHA EDITOR</p>
        <h2>{{ model.id ? '編輯卡池' : '新增卡池' }}</h2>
      </div>
      <button v-if="model.id" class="ghost-btn" type="button" @click="$emit('cancel')">取消編輯</button>
    </div>

    <div class="form-grid">
      <label class="field field-wide">
        <span>卡池名稱 *</span>
        <input v-model.trim="model.name" required placeholder="例如：海神之歌" />
      </label>

      <label class="field">
        <span>卡池類型 *</span>
        <select v-model="model.pool_type" required>
          <option v-for="type in poolTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
      </label>

      <label class="field">
        <span>開始日期 *</span>
        <input v-model="model.start_date" type="date" required />
      </label>

      <label class="field">
        <span>結束日期 *</span>
        <input v-model="model.end_date" type="date" required />
      </label>

      <label class="field field-wide">
        <span>登場角色</span>
        <div class="check-grid">
          <label v-for="character in characters" :key="character" class="check-pill">
            <input v-model="model.characters" type="checkbox" :value="character" />
            <span>{{ character }}</span>
          </label>
        </div>
      </label>

      <label class="field field-wide">
        <span>備註</span>
        <textarea v-model.trim="model.note" rows="3" placeholder="可留空"></textarea>
      </label>
    </div>

    <div class="switch-row">
      <label><input v-model="model.is_rerun" type="checkbox" /> 復刻卡池</label>
      <label><input v-model="model.is_published" type="checkbox" /> 公開顯示</label>
    </div>

    <div class="upload-section">
      <div class="upload-title-row">
        <div>
          <strong>卡池圖片</strong>
          <p>上傳時會在瀏覽器自動縮到 1200px 內並轉成 WebP，再送到 Supabase。</p>
        </div>
        <label class="upload-btn" :class="{ disabled: uploading }">
          {{ uploading ? '處理中…' : '＋ 上傳圖片' }}
          <input type="file" accept="image/*" multiple hidden :disabled="uploading" @change="handleFiles" />
        </label>
      </div>

      <div v-if="model.image_urls.length" class="image-list">
        <div v-for="(url, index) in model.image_urls" :key="url" class="image-item">
          <img :src="url" alt="卡池縮圖" />
          <div class="image-actions">
            <button type="button" :disabled="index === 0" @click="moveImage(index, -1)">←</button>
            <button type="button" :disabled="index === model.image_urls.length - 1" @click="moveImage(index, 1)">→</button>
            <button class="danger-text" type="button" @click="removeImage(index)">移除</button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="message" class="form-message" :class="{ error: hasError }">{{ message }}</p>

    <div class="submit-row">
      <button class="primary-btn" type="submit" :disabled="saving || uploading">
        {{ saving ? '儲存中…' : model.id ? '儲存修改' : '建立卡池' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { POOL_TYPES } from '../../constants/gacha'
import { blobToDataUrl, compressImage } from '../../utils/imageCompression'
import { uploadAdminImage } from '../../services/adminService'

const props = defineProps({
  value: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel'])

const characters = ['沈星回', '黎深', '祁煜', '秦徹', '夏以晝']
const poolTypes = POOL_TYPES
const uploading = ref(false)
const message = ref('')
const hasError = ref(false)

function emptyModel() {
  return {
    id: '',
    name: '',
    pool_type: 'single',
    characters: [],
    start_date: '',
    end_date: '',
    is_rerun: false,
    note: '',
    image_urls: [],
    image_paths: [],
    is_published: true,
    sort_order: 0,
  }
}

const model = reactive(emptyModel())

function assignModel(value) {
  Object.assign(model, emptyModel(), value || {})
  model.characters = [...(value?.characters || [])]
  model.image_urls = [...(value?.image_urls || [])]
  model.image_paths = [...(value?.image_paths || [])]
}

watch(() => props.value, assignModel, { immediate: true, deep: true })

async function handleFiles(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  if (!files.length) return

  uploading.value = true
  message.value = ''
  hasError.value = false
  try {
    for (const file of files) {
      const compressed = await compressImage(file)
      if (compressed.compressedSize > 2 * 1024 * 1024) throw new Error('壓縮後圖片仍超過 2MB')
      const data = await blobToDataUrl(compressed.blob)
      const uploaded = await uploadAdminImage({
        data,
        mimeType: compressed.type,
        year: model.start_date?.slice(0, 4) || new Date().getFullYear(),
      })
      model.image_urls.push(uploaded.url)
      model.image_paths.push(uploaded.path)
    }
    message.value = `完成上傳 ${files.length} 張圖片`
  } catch (error) {
    hasError.value = true
    message.value = error.message || '圖片上傳失敗'
  } finally {
    uploading.value = false
  }
}

function removeImage(index) {
  model.image_urls.splice(index, 1)
  model.image_paths.splice(index, 1)
}

function moveImage(index, direction) {
  const target = index + direction
  if (target < 0 || target >= model.image_urls.length) return
  ;[model.image_urls[index], model.image_urls[target]] = [model.image_urls[target], model.image_urls[index]]
  ;[model.image_paths[index], model.image_paths[target]] = [model.image_paths[target], model.image_paths[index]]
}

function submit() {
  message.value = ''
  hasError.value = false
  if (!model.name || !model.start_date || !model.end_date) {
    hasError.value = true
    message.value = '請填寫卡池名稱與日期'
    return
  }
  emit('save', JSON.parse(JSON.stringify(model)))
}
</script>

<style scoped>
.editor-card{border:1px solid rgba(226,232,240,.95);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 18px 40px rgba(31,41,55,.08);padding:22px}.editor-head,.upload-title-row,.submit-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.eyebrow{margin:0 0 5px;color:#7775d8;font-size:11px;font-weight:900;letter-spacing:.14em}.editor-head h2{margin:0;font-size:22px}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:20px}.field{display:grid;gap:7px;font-size:12px;font-weight:850;color:#4b5563}.field-wide{grid-column:1/-1}.field input,.field select,.field textarea{width:100%;box-sizing:border-box;border:1px solid #d9dde6;border-radius:13px;padding:10px 12px;background:#fff;color:#111827;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#aaa8f3;box-shadow:0 0 0 4px rgba(119,117,216,.12)}.check-grid{display:flex;flex-wrap:wrap;gap:8px}.check-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #e3e5eb;border-radius:999px;padding:7px 10px;background:#fafaff;font-size:12px}.switch-row{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0;font-size:13px;font-weight:800}.upload-section{border-top:1px solid #eef0f4;padding-top:18px}.upload-title-row p{margin:4px 0 0;color:#7b8190;font-size:12px;line-height:1.6}.upload-btn,.primary-btn,.ghost-btn{border:0;border-radius:999px;padding:9px 15px;font-weight:900;cursor:pointer}.upload-btn,.primary-btn{background:linear-gradient(135deg,#7775d8,#a58be7);color:#fff}.upload-btn.disabled{opacity:.55;pointer-events:none}.ghost-btn{border:1px solid #d9dde6;background:#fff;color:#5f6470}.image-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:14px}.image-item{border:1px solid #e4e6ec;border-radius:15px;overflow:hidden;background:#fafafa}.image-item img{display:block;width:100%;aspect-ratio:1/1;object-fit:contain;background:#f5f6fb}.image-actions{display:flex;gap:4px;padding:7px}.image-actions button{border:1px solid #dddfe6;background:#fff;border-radius:8px;padding:4px 7px;cursor:pointer;font-size:11px}.danger-text{color:#c43f58}.form-message{margin:14px 0 0;border-radius:12px;padding:9px 12px;background:#eefbf6;color:#08785d;font-size:12px}.form-message.error{background:#fff1f2;color:#a9233a}.submit-row{justify-content:flex-end;margin-top:18px}.primary-btn:disabled{opacity:.55;cursor:wait}@media(max-width:760px){.form-grid{grid-template-columns:1fr}.field-wide{grid-column:auto}.editor-card{padding:16px}.upload-title-row{display:grid}}
</style>
