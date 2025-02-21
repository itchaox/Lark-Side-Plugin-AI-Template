/*
 * @Version    : v1.00
 * @Author     : Wang Chao
 * @Date       : 2025-02-21 13:44
 * @LastAuthor : Wang Chao
 * @LastTime   : 2025-02-21 17:12
 * @desc       :
 */
import { createApp } from 'vue';
import App from './App.vue';
import 'element-plus/dist/index.css';
import './assets/main.css';
import { bitable } from '@lark-base-open/js-sdk';
import { i18n } from './locales/i18n.js';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import en from 'element-plus/dist/locale/en.mjs';

const app = createApp(App);
// 注入国际化函数$t
bitable.bridge.getLanguage().then((lang) => {
  i18n.global.locale = lang;
  const _isZh = lang === 'zh' || lang === 'zh-HK' || lang === 'zh-TW';

  app.use(ElementPlus, {
    locale: _isZh ? zhCn : en,
  });
});

app.use(i18n);
app.mount('#app');
