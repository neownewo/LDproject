<template>
  <AppLayout>
    <section class="post-shell">
      <div class="post-header">
        <button class="back-btn" type="button" @click="goBack">← 返回攻略列表</button>

        <p class="eyebrow">SUNTEAM ARTICLE</p>
        <h1>{{ articleTitle }}</h1>

        <div class="post-meta">
          <span v-if="category">{{ category }}</span>
          <span v-if="date">{{ date }}</span>

          <a v-if="articleUrl" :href="articleUrl" target="_blank" rel="noopener noreferrer">
            另開文章
          </a>

          <a
            v-if="writer"
            :href="writerThreadsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="writer-link"
          >
            作者：{{ writerDisplayName }}
          </a>
        </div>
      </div>

      <div v-if="embedUrl" class="embed-frame-card" :class="`${embedType}-frame-card`">
        <iframe
          :src="embedUrl"
          class="embed-frame"
          :class="`${embedType}-frame`"
          frameborder="0"
          allowfullscreen="true"
          mozallowfullscreen="true"
          webkitallowfullscreen="true"
        ></iframe>
      </div>

      <div v-else class="empty-state">
        找不到文章連結，請回到攻略列表重新進入。
      </div>
    </section>
  </AppLayout>
</template>

<script setup>
import '../styles/common.css'
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from './AppLayout.vue'

const route = useRoute()
const router = useRouter()

// 從 Guides.vue 傳進來：/guide-post?title=xxx&link=Notion網址
const articleUrl = computed(() => {
  // 文章嵌入來源只能抓「文章連結」
  // 避免誤抓「文章縮圖連結固定勾選即可」
  const url =
    route.query['文章連結'] ||
    route.query.articleUrl ||
    route.query.contentUrl ||
    route.query.link ||
    route.query.url ||
    ''

  return typeof url === 'string' ? url.trim() : ''
})

const articleTitle = computed(() => {
  const title =
    route.query.title ||
    route.query['攻略標題'] ||
    route.params.slug ||
    '攻略文章'

  return typeof title === 'string' ? title : '攻略文章'
})

const category = computed(() => {
  const value =
    route.query.category ||
    route.query['類別'] ||
    ''

  return typeof value === 'string' ? value : ''
})

const date = computed(() => {
  const value =
    route.query.date ||
    route.query['文章上傳日'] ||
    ''

  return typeof value === 'string' ? value : ''
})

const writer = computed(() => {
  const value =
    route.query.writer ||
    route.query['作者名稱'] ||
    route.query.author ||
    ''

  return typeof value === 'string' ? value.trim() : ''
})

const writerDisplayName = computed(() => {
  if (!writer.value) return ''
  return writer.value.startsWith('@') ? writer.value : `@${writer.value}`
})

const writerThreadsUrl = computed(() => getWriterThreadsUrl(writer.value))

// 支援 Google Sheet 直接填：
// 1. Notion 一般網址 / Notion embed 網址
// 2. Google Slides 一般分享網址 / 發佈到網路網址 / iframe embed 程式碼
const embedData = computed(() => buildEmbedData(articleUrl.value))
const embedUrl = computed(() => embedData.value.url)
const embedType = computed(() => embedData.value.type || 'notion')

const iframeLoaded = ref(false)
const iframeFailed = ref(false)
let notionLoadTimer = null

const isNotionEmbed = computed(() => embedType.value === 'notion')
const shouldShowIframe = computed(() => !isNotionEmbed.value || !iframeFailed.value)
const showEmbedFallback = computed(() => isNotionEmbed.value && iframeFailed.value)

function handleIframeLoad() {
  iframeLoaded.value = true

  if (notionLoadTimer) {
    clearTimeout(notionLoadTimer)
    notionLoadTimer = null
  }
}

function startNotionLoadTimer() {
  iframeLoaded.value = false
  iframeFailed.value = false

  if (notionLoadTimer) {
    clearTimeout(notionLoadTimer)
    notionLoadTimer = null
  }

  if (!isNotionEmbed.value || !embedUrl.value) return

  notionLoadTimer = setTimeout(() => {
    if (!iframeLoaded.value) {
      iframeFailed.value = true
    }
  }, 8000)
}

onMounted(() => {
  startNotionLoadTimer()
})

watch([embedUrl, embedType], () => {
  startNotionLoadTimer()
})

onBeforeUnmount(() => {
  if (notionLoadTimer) {
    clearTimeout(notionLoadTimer)
  }
})

function buildEmbedData(rawValue) {
  const url = extractUrlFromInput(rawValue)
  if (!url) return { type: '', url: '' }

  if (isGoogleSlidesUrl(url)) {
    return {
      type: 'slides',
      url: buildGoogleSlidesEmbedUrl(url)
    }
  }

  return {
    type: 'notion',
    url: buildNotionEmbedUrl(url)
  }
}

function getWriterThreadsUrl(writer) {
  if (!writer) return '#'

  const value = String(writer).trim()

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  const cleanWriter = value.replace('@', '').trim()

  return `https://www.threads.net/@${cleanWriter}`
}

function extractUrlFromInput(value) {
  if (!value) return ''

  const text = String(value).trim()

  // 如果 Sheet 裡直接貼 Google iframe embed code，就自動抓 src
  const iframeSrcMatch = text.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i)
  if (iframeSrcMatch?.[1]) {
    return iframeSrcMatch[1].trim()
  }

  return text
}

function isGoogleSlidesUrl(url) {
  return /docs\.google\.com\/presentation\//i.test(url)
}

function isNotionUrl(url) {
  return /notion\.site|notion\.so/i.test(url)
}

function buildGoogleSlidesEmbedUrl(url) {
  try {
    const parsed = new URL(url)

    // 已經是可嵌入網址，直接補上常用參數後回傳
    if (parsed.pathname.includes('/embed') || parsed.pathname.includes('/pubembed')) {
      if (!parsed.searchParams.has('start')) parsed.searchParams.set('start', 'false')
      if (!parsed.searchParams.has('loop')) parsed.searchParams.set('loop', 'false')
      if (!parsed.searchParams.has('delayms')) parsed.searchParams.set('delayms', '5000')
      return parsed.toString()
    }

    // 發佈到網路的 /pub 或 /pubhtml 轉 /pubembed
    if (parsed.pathname.includes('/pub') || parsed.pathname.includes('/pubhtml')) {
      parsed.pathname = parsed.pathname
        .replace('/pubhtml', '/pubembed')
        .replace('/pub', '/pubembed')
      parsed.searchParams.set('start', parsed.searchParams.get('start') || 'false')
      parsed.searchParams.set('loop', parsed.searchParams.get('loop') || 'false')
      parsed.searchParams.set('delayms', parsed.searchParams.get('delayms') || '5000')
      return parsed.toString()
    }

    // 一般分享網址：https://docs.google.com/presentation/d/{id}/edit
    const normalIdMatch = parsed.pathname.match(/\/presentation\/d\/([^/]+)/)
    if (normalIdMatch?.[1]) {
      return `https://docs.google.com/presentation/d/${normalIdMatch[1]}/embed?start=false&loop=false&delayms=5000`
    }

    // 發佈網址：https://docs.google.com/presentation/d/e/{id}/...
    const publishIdMatch = parsed.pathname.match(/\/presentation\/d\/e\/([^/]+)/)
    if (publishIdMatch?.[1]) {
      return `https://docs.google.com/presentation/d/e/${publishIdMatch[1]}/pubembed?start=false&loop=false&delayms=5000`
    }

    return url
  } catch (error) {
    console.warn('Google Slides link 格式無法轉換：', url, error)
    return url
  }
}

function buildNotionEmbedUrl(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)

    // 已經是 Notion embed URL，直接修正 /ebd// 成 /ebd/
    if (parsed.pathname.includes('/ebd/')) {
      parsed.pathname = parsed.pathname.replace(/\/ebd\/+/g, '/ebd/')
      return parsed.toString()
    }

    const notionId = extractNotionPageId(parsed)
    if (!notionId) return url

    // 優先使用原本的 notion.site 網域，保留你的 workspace domain
    const host = parsed.hostname.includes('notion.site')
      ? parsed.hostname
      : 'www.notion.so'

    return `https://${host}/ebd/${notionId}`
  } catch (error) {
    console.warn('Notion link 格式無法轉換：', url, error)
    return url
  }
}

function extractNotionPageId(parsedUrl) {
  const pathname = decodeURIComponent(parsedUrl.pathname)
  const pathMatch = pathname.match(/([a-f0-9]{32})(?:[/?#-]|$)/i)
  if (pathMatch?.[1]) return pathMatch[1]

  const queryId = parsedUrl.searchParams.get('p') || parsedUrl.searchParams.get('page')
  const queryMatch = queryId?.match(/([a-f0-9]{32})/i)
  if (queryMatch?.[1]) return queryMatch[1]

  return ''
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/guides')
}
</script>

<style scoped>
.post-shell {
  display: grid;
  gap: 18px;
}

.post-header,
.embed-frame-card,
.empty-state {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 42px rgba(31, 41, 55, 0.08);
}

.post-header {
  padding: 24px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  margin-bottom: 18px;
  border: 0;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  background: rgba(243, 244, 246, 0.95);
  color: rgba(55, 65, 81, 0.95);
  font-weight: 800;
}

.back-btn:hover {
  background: rgba(229, 231, 235, 0.95);
}

.eyebrow {
  margin: 0 0 8px;
  color: rgba(99, 102, 241, 0.86);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.post-header h1 {
  margin: 0;
  color: rgba(17, 24, 39, 0.92);
  font-size: clamp(26px, 4vw, 40px);
  line-height: 1.2;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  color: rgba(107, 114, 128, 0.96);
  font-size: 13px;
  font-weight: 800;
}

.post-meta span,
.post-meta a {
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(246, 199, 216, 0.24);
  color: rgba(75, 85, 99, 0.94);
  text-decoration: none;
}

.post-meta a {
  background: rgba(184, 217, 255, 0.34);
  color: rgba(79, 70, 229, 0.94);
}

.embed-frame-card {
  overflow: hidden;
  padding: 0;
}

.embed-frame {
  display: block;
  width: 100%;
  min-height: 76vh;
  border: 0;
  border-radius: 24px;
  background: #fff;
}

.slides-frame {
  aspect-ratio: 16 / 9;
  min-height: auto;
  height: auto;
}

.empty-state {
  padding: 28px;
  color: rgba(107, 114, 128, 0.96);
  text-align: center;
}

@media (max-width: 720px) {
  .post-header,
  .empty-state {
    border-radius: 18px;
    padding: 18px;
  }

  .embed-frame-card,
  .notion-frame {
    border-radius: 18px;
  }

  .embed-frame {
    min-height: 72vh;
  }

  .slides-frame {
    min-height: auto;
  }
}

.writer-link {
  color: #8b5cf6;
  font-weight: 700;
  text-decoration: none;
}

.writer-link:hover {
  text-decoration: underline;
}

.embed-fallback-card {
  margin: 24px 0;
  padding: 28px 22px;
  border-radius: 20px;
  background: #faf5ff;
  border: 1px solid #d8b4fe;
  color: #6b21a8;
  text-align: center;
  line-height: 1.8;
  font-weight: 700;
}

</style>
