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
        </div>
      </div>

      <div v-if="embedUrl" class="notion-frame-card">
        <iframe
          :src="embedUrl"
          class="notion-frame"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>

      <div v-else class="empty-state">
        找不到文章連結，請回到攻略列表重新進入。
      </div>
    </section>
  </AppLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from './AppLayout.vue'

const route = useRoute()
const router = useRouter()

// 從 Guides.vue 傳進來：/guide-post?title=xxx&link=Notion網址
const articleUrl = computed(() => {
  const url = route.query.url || route.query.link || ''
  return typeof url === 'string' ? url.trim() : ''
})

const articleTitle = computed(() => {
  const title = route.query.title || route.params.slug || '攻略文章'
  return typeof title === 'string' ? title : '攻略文章'
})

const category = computed(() => {
  const value = route.query.category || ''
  return typeof value === 'string' ? value : ''
})

const date = computed(() => {
  const value = route.query.date || ''
  return typeof value === 'string' ? value : ''
})

// 支援兩種 Google Sheet link 寫法：
// 1. 直接填 Notion embed URL：https://xxx.notion.site/ebd/pageId
// 2. 填一般 Notion URL：https://xxx.notion.site/page-title-pageId 或 https://www.notion.so/pageId
const embedUrl = computed(() => buildNotionEmbedUrl(articleUrl.value))

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
.notion-frame-card,
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

.notion-frame-card {
  overflow: hidden;
  padding: 0;
}

.notion-frame {
  display: block;
  width: 100%;
  min-height: 76vh;
  border: 0;
  border-radius: 24px;
  background: #fff;
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

  .notion-frame-card,
  .notion-frame {
    border-radius: 18px;
  }

  .notion-frame {
    min-height: 72vh;
  }
}
</style>
