import { createApp } from 'vue'
// import './style.css'
import App from './App.vue'
import ElementPlus, {ElMessage} from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router.js' // 确保路径正确
import * as ElementPlusIconsVue from '@element-plus/icons-vue'  // 新增导入
const app = createApp(App)


// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}
app.config.errorHandler = (err) => {
    console.error('全局错误:', err)
    ElMessage.error('发生了一个错误')
}
app.use(ElementPlus)
app.use(router)
app.mount('#app')
// createApp(App).use(ElementPlus).mount('#app')
