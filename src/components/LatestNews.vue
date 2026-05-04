<template>
  <section class="card card-pad">
    <div class="row">
      <div>
        <h2 class="h1" style="margin:0;">最新消息</h2>
        <div class="hint">自動顯示官方粉專最新貼文（若看不到，請點右側連結）</div>
      </div>

      <a class="btn" :href="pageUrl" target="_blank" rel="noopener noreferrer">
        前往官方粉專
      </a>
    </div>

    <div class="divider"></div>

    <!-- Facebook Page Plugin（時間軸） -->
    <div class="fb-wrap">
      <div
        class="fb-page"
        :data-href="pageUrl"
        data-tabs="timeline"
        data-width="500"
        data-height="680"
        data-small-header="false"
        data-adapt-container-width="true"
        data-hide-cover="false"
        data-show-facepile="false"
      >
        <blockquote :cite="pageUrl" class="fb-xfbml-parse-ignore">
          <a :href="pageUrl" target="_blank" rel="noopener noreferrer">Facebook</a>
        </blockquote>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { loadFacebookSDK, parseFacebookXFBML } from '../lib/fbSdk'

const props = defineProps({
  // 你之後只要把繁中官方粉專網址丟進來
  pageUrl: { type: String, required: true },
  locale: { type: String, default: 'zh_TW' },
})

// 避免 template 混邏輯：載入與 parse 全在 script
async function boot() {
  await loadFacebookSDK({ locale: props.locale })
  // SDK 載入後 parse 讓嵌入出現
  parseFacebookXFBML()
}

onMounted(boot)

// 如果 pageUrl 之後改了（例如你換粉專），也能重新 parse
watch(
  () => props.pageUrl,
  async () => {
    await boot()
  }
)
</script>

<style scoped>
.row{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.hint{
  margin-top:6px;
  color: var(--muted);
  font-size: 13px;
}
.divider{
  height:1px;
  background: var(--line);
  margin: 12px 0 14px;
}
.fb-wrap{
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,.55);
}

/* 小螢幕讓按鈕自動換行 */
@media (max-width: 520px){
  .row{ flex-direction: column; align-items: stretch; }
}
</style>
