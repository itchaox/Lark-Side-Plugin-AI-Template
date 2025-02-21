/*
 * @Version    : v1.00
 * @Author     : itchaox
 * @Date       : 2023-06-21 11:48
 * @LastAuthor : Wang Chao
 * @LastTime   : 2025-02-21 13:45
 * @desc       :
 */

import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';

import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: true,
    hmr: true, //启动热更新，就是更改了代码自动刷新页面
    // open: true, //代表vite项目在启动时自动打开浏览器
    proxy: {
      '/api': {
        target: 'https://open.feishu.cn',
        //你的需要请求的服务器地址
        changeOrigin: true, // 允许跨域
        secure: false, //忽略安全证书
        rewrite: (path) => path.replace(/^\/api/, ''), // 重写路径把路径变成空字符,
      },
    },
  },
  plugins: [
    vue(),

    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
