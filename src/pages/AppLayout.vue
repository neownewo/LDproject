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

    <!-- 左側收放選單：由 Home / Guides 共用 -->
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

    <main class="content">
      <slot />

      <footer class="site-footer">
        <p>
          本網站為個人整理與非官方攻略資訊站，僅供玩家交流與資料整理使用。
        </p>
        <p>
          遊戲圖片、角色名稱、活動資訊與相關素材版權皆屬《戀與深空》官方及所屬公司所有。
        </p>
      </footer>
    </main>

    <slot name="fixed" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { mainMenuItems } from '../menu.config'

defineProps({
  menuItems: {
    type: Array,
    default: () => mainMenuItems,
  },
})

const isMenuCollapsed = ref(false)
const isMobileMenuOpen = ref(false)
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
}
.site-footer {
  margin-top: 48px;

  padding: 24px 20px 40px;

  text-align: center;

  font-size: 11px;
  line-height: 1.8;

  color: #999;

  opacity: 0.9;
}

.site-footer p {
  margin: 4px 0;
}
</style>
