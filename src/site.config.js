// src/site.config.js
export const SITE = {
  title: '戀與深空攻略情報',
  sections: [
    { id: 'news', title: '最新消息', desc: '自動同步官方最新公告（先保留區塊）' },
    { id: 'howto', title: '玩法介紹', desc: '整理重點並連到官方介紹頁', href: 'https://loveanddeepspace.infoldgames.com/zh-TW/home' },
    { id: 'beginner', title: '新手指南', desc: '開局資源、每日必做、入門觀念', to: '/guides' },
    { id: 'gacha', title: '卡池歷程整理', desc: '用行事曆視覺化每期卡池縮圖', to: '/gacha' },
    { id: 'merch', title: '周邊整理', desc: '分類、整理、連結與備註', to: '/merch' },
  ],
}
