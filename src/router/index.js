import { createRouter, createWebHistory } from 'vue-router'

import Home from '../pages/Home.vue'
import Guides from '../pages/Guides.vue'
import GuidePost from '../pages/GuidePost.vue'
import Gacha from '../pages/GachaCalendar.vue'
import Merch from '../pages/Guides.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/guides', component: Guides },
  {path: '/guide-post',component: GuidePost},
  { path: '/gacha', component: Gacha },
  { path: '/merch', component: Merch },

]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
