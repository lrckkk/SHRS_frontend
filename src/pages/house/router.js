import { createRouter, createWebHistory } from 'vue-router'

// 您的路由定义
const routes = [
    // 您的路由配置
    {
        path: '/',
        component: () => import('./App.vue')
    },

]


// 创建路由器实例
const router = createRouter({
    history: createWebHistory(),
    routes
})

// 解决方案1：添加默认导出
export default router

// 或者解决方案2：使用命名导出
// export { router }