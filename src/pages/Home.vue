<template>
  <div class="home-shell" :class="{ 'menu-collapsed': isMenuCollapsed, 'mobile-menu-open': isMobileMenuOpen }">
    <!-- 手機版選單開關 -->
    <button
      class="mobile-menu-toggle"
      type="button"
      :aria-expanded="isMobileMenuOpen"
      aria-controls="home-side-menu"
      @click="isMobileMenuOpen = !isMobileMenuOpen"
    >
      <span class="hamburger" aria-hidden="true"></span>
      <span>網站選單</span>
    </button>

    <!-- 手機版背景遮罩 -->
    <div
      v-if="isMobileMenuOpen"
      class="mobile-menu-backdrop"
      aria-hidden="true"
      @click="isMobileMenuOpen = false"
    ></div>

    <!-- 左側收放選單 -->
    <aside id="home-side-menu" class="side-menu" aria-label="網站選單">
      <div class="side-menu-header">
        <div class="side-menu-brand">
          <span class="brand-dot" aria-hidden="true"></span>
          <span v-show="!isMenuCollapsed" class="brand-text">網站選單</span>
        </div>

        <button
          class="collapse-toggle"
          type="button"
          :aria-label="isMenuCollapsed ? '展開選單' : '收合選單'"
          @click="isMenuCollapsed = !isMenuCollapsed"
        >
          {{ isMenuCollapsed ? '›' : '‹' }}
        </button>
      </div>

      <nav class="side-menu-nav">
        <a
          v-for="item in menuItems"
          :key="item.href"
          class="side-menu-link"
          :href="item.href"
          :title="item.label"
          @click="isMobileMenuOpen = false"
        >
          <span class="menu-icon" aria-hidden="true">{{ item.icon }}</span>
          <span v-show="!isMenuCollapsed" class="menu-label">{{ item.label }}</span>
        </a>
      </nav>
    </aside>

    <main class="home-content">
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

      <!-- 功能章節：功能清單風格 
      <PageSection id="howto" eyebrow="LINK" title="玩法介紹" desc="整理重點並連到官方玩法介紹">
        <FeatureList :items="howto" />
        <div class="actions">
          <a class="btn btn-primary" :href="OFFICIAL_GAME_INTRO_URL" target="_blank" rel="noopener noreferrer">
            前往官方玩法介紹
          </a>
        </div>
      </PageSection>-->

      <PageSection id="beginner" eyebrow="GUIDE" title="新手指南" desc="開局資源、每日必做、入門觀念">
        <FeatureList :items="beginner" />
        <div class="actions">
          <router-link class="btn btn-primary" to="/guides">進入新手指南</router-link>
        </div>
      </PageSection>

      <PageSection id="gacha" eyebrow="CALENDAR" title="卡池歷程整理" desc="用行事曆視覺化每期卡池縮圖代表顯示">
        <FeatureList :items="gacha" />
        <div class="actions">
          <router-link class="btn btn-primary" to="/gacha">查看卡池行事曆</router-link>
        </div>
      </PageSection>

      <PageSection id="merch" eyebrow="LIST" title="周邊整理" desc="分類整理與連結，方便查找與比對">
        <FeatureList :items="merch" />
        <div class="actions">
          <router-link class="btn btn-primary" to="/merch">查看周邊整理</router-link>
        </div>
      </PageSection>
    </main>

    <!-- 右下角：最近生日 / 活動日期倒數 -->
    <aside v-if="nextCountdownEvent" class="date-countdown" aria-label="最近活動倒數">
      <div class="date-countdown__eyebrow">最近活動</div>
      <div class="date-countdown__title">{{ nextCountdownEvent.title }}</div>
      <div class="date-countdown__date">{{ nextCountdownEvent.displayDate }}</div>
      <div class="date-countdown__days">
        {{ nextCountdownEvent.daysLeft === 0 ? '今天' : `還有 ${nextCountdownEvent.daysLeft} 天` }}
      </div>
      
    </aside>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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

const isMenuCollapsed = ref(false)
const isMobileMenuOpen = ref(false)

const menuItems = [
  { label: '首頁主視覺', href: '#hero', icon: '✦' },
  { label: '最新消息', href: '#news', icon: '📌' },
  { label: '新手指南', href: '#beginner', icon: '🔰' },
  { label: '卡池歷程', href: '#gacha', icon: '🗓️' },
  { label: '周邊整理', href: '#merch', icon: '🎁' },
]

const howto = [
  { label: '官方玩法入口', value: '本站做重點索引與導讀，內容以官方頁為準' },
  { label: '維護成本', value: '只維護你的整理文字與外連，避免素材風險' },
]
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
.home-shell {
  --side-menu-width: 232px;
  --side-menu-collapsed-width: 76px;

  display: grid;
  grid-template-columns: var(--side-menu-width) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  transition: grid-template-columns 0.25s ease;
}

.home-shell.menu-collapsed {
  grid-template-columns: var(--side-menu-collapsed-width) minmax(0, 1fr);
}

.home-content {
  min-width: 0;
}

.home-content section,
.home-content :deep(section) {
  scroll-margin-top: 28px;
}

.side-menu {
  position: sticky;
  top: 18px;
  z-index: 20;
  min-height: calc(100vh - 36px);
  padding: 16px 12px;
  border: 1px solid rgba(255,255,255,.68);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 42px rgba(31, 41, 55, 0.12);
  backdrop-filter: blur(14px);
  overflow: hidden;
}

.side-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.side-menu-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-weight: 800;
  color: rgba(17, 24, 39, 0.86);
}

.brand-dot {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 999px;
  background: linear-gradient(135deg, #f6c7d8, #b8d9ff);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.62);
}

.brand-text,
.menu-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapse-toggle,
.mobile-menu-toggle {
  border: 0;
  cursor: pointer;
  color: rgba(17, 24, 39, 0.78);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.10);
}

.collapse-toggle {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 999px;
  font-size: 24px;
  line-height: 1;
}

.side-menu-nav {
  display: grid;
  gap: 8px;
}

.side-menu-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px;
  border-radius: 14px;
  color: rgba(17, 24, 39, 0.78);
  text-decoration: none;
  transition: background 0.2s ease, transform 0.2s ease, color 0.2s ease;
}

.side-menu-link:hover {
  background: rgba(255, 255, 255, 0.82);
  color: rgba(17, 24, 39, 0.96);
  transform: translateX(2px);
}

.menu-icon {
  width: 32px;
  flex: 0 0 32px;
  text-align: center;
  font-size: 18px;
}

.menu-label {
  font-size: 15px;
  font-weight: 700;
}

.mobile-menu-toggle,
.mobile-menu-backdrop {
  display: none;
}

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

.date-countdown__note {
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(75, 85, 99, 0.9);
}

@media (max-width: 900px) {
  .home-shell,
  .home-shell.menu-collapsed {
    display: block;
  }

  .mobile-menu-toggle {
    position: sticky;
    top: 10px;
    z-index: 35;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding: 10px 14px;
    border-radius: 999px;
    font-weight: 800;
  }

  .hamburger,
  .hamburger::before,
  .hamburger::after {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 99px;
    background: currentColor;
  }

  .hamburger {
    position: relative;
  }

  .hamburger::before,
  .hamburger::after {
    content: '';
    position: absolute;
    left: 0;
  }

  .hamburger::before {
    top: -6px;
  }

  .hamburger::after {
    top: 6px;
  }

  .mobile-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: block;
    background: rgba(15, 23, 42, 0.28);
  }

  .side-menu {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
    width: min(82vw, 300px);
    height: 100vh;
    min-height: 100vh;
    border-radius: 0 24px 24px 0;
    transform: translateX(-104%);
    transition: transform 0.25s ease;
  }

  .mobile-menu-open .side-menu {
    transform: translateX(0);
  }

  .collapse-toggle {
    display: none;
  }

  .brand-text,
  .menu-label {
    display: inline !important;
  }

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
