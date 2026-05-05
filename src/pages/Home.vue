<template>
  <AppLayout>
    <!-- 中間主視覺（你放圖片） -->
    <section id="hero">
      <HeroBanner
        :title="SITE.title"
        desc="本攻略網站皆為個人蒐集資料開發架設，若有任何問題請先聯繫我的脆處理 @neiwniew"
      >
        <template #actions>
          <router-link class="btn btn-primary" to="/guides">新手指南</router-link>
          <router-link class="btn" to="/gacha">卡池行事曆</router-link>
          <router-link class="btn" to="/merch">周邊整理</router-link>
        </template>
      </HeroBanner>
    </section>

    <!-- 最新消息：佈告欄 -->
    <section id="news">
      <BulletinBoard title="最新消息">
        <template #right>
          <a class="btn" :href="OFFICIAL_GAME_INTRO_URL" target="_blank" rel="noopener noreferrer">
            前往官方網站
          </a>
        </template>

        <div class="fb-wrapper">
          <iframe
            :src="`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(OFFICIAL_FB_PAGE_URL)}&tabs=timeline&width=500&height=600&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=false`"
            title="戀與深空官方 Facebook 最新消息"
            width="500"
            height="600"
            style="border:none;overflow:hidden"
            scrolling="no"
            frameborder="0"
            allowfullscreen="true"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          ></iframe>
        </div>
      </BulletinBoard>
    </section>

    <PageSection id="beginner" eyebrow="GUIDE" title="遊戲攻略" desc="開局資源、每日必做、入門觀念">
      <FeatureList :items="beginner" />
      <div class="actions">
        <router-link class="btn btn-primary" to="/guides">進入遊戲攻略</router-link>
      </div>
    </PageSection>

    <PageSection id="gacha" eyebrow="CALENDAR" title="卡池歷程整理" desc="用行事曆視覺化每期卡池縮圖代表顯示">
      <FeatureList :items="gacha" />
      <div class="actions">
        <router-link class="btn btn-primary" to="/">查看卡池行事曆</router-link>
      </div>
    </PageSection>

    <PageSection id="merch" eyebrow="LIST" title="周邊整理" desc="分類整理與連結，方便查找與比對">
      <FeatureList :items="merch" />
      <div class="actions">
        <router-link class="btn btn-primary" to="/">查看周邊整理</router-link>
      </div>
    </PageSection>

    <template #fixed>
      <!-- 右下角：最近生日 / 活動日期倒數 -->
      <aside v-if="nextCountdownEvent" class="date-countdown" aria-label="最近活動倒數">
        <div class="date-countdown__eyebrow">最近活動</div>
        <div class="date-countdown__title">{{ nextCountdownEvent.title }}</div>
        <div class="date-countdown__date">{{ nextCountdownEvent.displayDate }}</div>
        <div class="date-countdown__days">
          {{ nextCountdownEvent.daysLeft === 0 ? '今天' : `還有 ${nextCountdownEvent.daysLeft} 天` }}
        </div>
      </aside>
    </template>
  </AppLayout>
</template>

<script setup>
import { computed } from 'vue'
import AppLayout from './AppLayout.vue'
import HeroBanner from '../components/HeroBanner.vue'
import BulletinBoard from '../components/BulletinBoard.vue'
import PageSection from '../components/PageSection.vue'
import FeatureList from '../components/FeatureList.vue'
import { SITE } from '../site.config'

const OFFICIAL_FB_PAGE_URL = 'https://www.facebook.com/loveanddeepspace.tw'
const OFFICIAL_GAME_INTRO_URL = 'https://loveanddeepspace.infoldgames.com/zh-TW/home#2'

// 在這裡維護生日 / 活動日期即可
// recurring: true 代表每年都會自動倒數，例如角色生日
// recurring: false 代表只倒數指定年份的一次性活動
const countdownEvents = [
  { title: '祁煜生日', month: 3, day: 6, note: '祁煜生日', recurring: true },
  { title: '秦徹生日', month: 4, day: 18, note: '秦徹生日', recurring: true },
  { title: '夏以晝生日', month: 6, day: 13, note: '夏以晝生日', recurring: true },
  { title: '黎深生日', month: 9, day: 5, note: '黎深生日', recurring: true },
  { title: '沈星回生日', month: 10, day: 16, note: '沈星回生日', recurring: true },

  // 一次性活動範例：
  // { title: '網站正式公開', date: '2026-03-15', note: '活動頁上線', recurring: false },
]

const getLocalToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const getEventDate = (event, today) => {
  if (event.date) {
    const [year, month, day] = event.date.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const thisYearDate = new Date(today.getFullYear(), event.month - 1, event.day)
  if (event.recurring === false || thisYearDate >= today) {
    return thisYearDate
  }

  return new Date(today.getFullYear() + 1, event.month - 1, event.day)
}

const formatDisplayDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

const nextCountdownEvent = computed(() => {
  const today = getLocalToday()
  const oneDay = 24 * 60 * 60 * 1000

  return countdownEvents
    .map((event) => {
      const targetDate = getEventDate(event, today)
      const daysLeft = Math.round((targetDate - today) / oneDay)

      return {
        ...event,
        targetDate,
        daysLeft,
        displayDate: formatDisplayDate(targetDate),
      }
    })
    .filter((event) => event.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0]
})

const beginner = [
  { label: '開局', value: '先把資源與每日流程跑順' },
  { label: '養成', value: '用簡單表格整理優先順序' },
]
const gacha = [
  { label: '視覺化', value: '月曆呈現每期卡池起訖，事件帶縮圖' },
  { label: '資料維護', value: '用 JSON 新增每期卡池，不用改程式' },
]
const merch = [
  { label: '分類', value: '立牌 / 徽章 / 服飾 / 娃娃 / 其他' },
  { label: '欄位', value: '名稱、類別、發售日、來源連結、備註' },
]
</script>

<style scoped>
.fb-wrapper {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 16px;
}

.fb-wrapper iframe {
  display: block;
  width: 100%;
  max-width: 500px;
}

.actions{
  margin-top: 12px;
  display:flex;
  justify-content:center;
}

.placeholder{
  border: 1px dashed rgba(17,24,39,.18);
  border-radius: 14px;
  padding: 16px;
  background: rgba(255,255,255,.65);
  color: rgba(17,24,39,.60);
  text-align:center;
}

.date-countdown {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 25;
  width: min(210px, calc(100vw - 36px));
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 14px 34px rgba(31, 41, 55, 0.13);
  backdrop-filter: blur(14px);
  color: rgba(17, 24, 39, 0.82);
}

.date-countdown__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgba(107, 114, 128, 0.9);
}

.date-countdown__title {
  font-size: 15px;
  font-weight: 900;
  line-height: 1.35;
}

.date-countdown__date {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(75, 85, 99, 0.86);
}

.date-countdown__days {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(246, 199, 216, 0.34);
  font-size: 13px;
  font-weight: 900;
}

@media (max-width: 900px) {
  .date-countdown {
    right: 12px;
    bottom: 12px;
    width: min(188px, calc(100vw - 24px));
    padding: 10px 12px;
  }

  .date-countdown__title {
    font-size: 14px;
  }
}

@media (max-width: 520px) {
  .fb-wrapper iframe {
    height: 520px;
  }

  .actions {
    flex-wrap: wrap;
  }
}
</style>
