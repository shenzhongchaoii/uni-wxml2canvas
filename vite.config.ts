import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      // 输出目录，默认与 outDir 相同
      outDir: 'dist/types'
    })
  ],
  build: {
    lib: {
      // 指定入口文件
      entry: resolve(__dirname, 'src/index.ts'),
      // 库名称
      name: 'uni-wxml2canvas',
      // 文件名称
      fileName: format => `index.${format}.js`,
      // 输出格式
      formats: ['es', 'umd', 'cjs']
    },
    rollupOptions: {
      output: {
        // UMD 格式下 uni 的全局变量名
        globals: {
          uni: 'uni'
          // 如果有其他特定的 uni 方法需要单独指定，也可以添加在这里
        }
      }
    },
    // 输出目录
    outDir: 'dist',
    // 确保文件命名一致
    emptyOutDir: true,
    sourcemap: true,
    // 压缩代码
    minify: 'terser'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
