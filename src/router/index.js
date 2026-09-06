import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../pages/Home.vue') },
  { path: '/guides', component: () => import('../pages/Guides.vue') },
  { path: '/guide-post', component: () => import('../pages/GuidePost.vue') },
  { path: '/gacha', component: () => import('../pages/GachaCalendar.vue') },
  { path: '/sunteam', component: () => import('../pages/Sunteam.vue') },
  { path: '/sunteam-post', component: () => import('../pages/SunteamPost.vue') },
  { path: '/events', component: () => import('../pages/Events.vue') },
  { path: '/neiwneiw', component: () => import('../pages/neiwneiw/Neiwneiw.vue'), meta: { hidden: true } },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
