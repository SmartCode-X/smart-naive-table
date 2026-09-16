import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// 多数测试只覆盖 UI 无关 core(纯逻辑 + stub localStorage),默认 node 环境即可;
// 少数需要挂载 SFC 断言渲染/事件行为的测试文件,在文件顶部用
// `// @vitest-environment jsdom` 单独声明,避免拖慢/影响其余纯逻辑测试。
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
