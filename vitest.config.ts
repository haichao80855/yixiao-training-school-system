import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * 前端单元测试 (Vitest)。复用 vite.config.ts 的别名 (@/)、Vue 插件和 Element Plus 按需引入，
 * 测试加载代码的方式和真实构建一致。
 *
 * - tests/unit/**\/*.spec.{js,ts}：不需要后端，默认 node 环境；需要 DOM 的文件在开头写 `// @vitest-environment jsdom`
 * - *.server.spec.*：需要真实后端 (TEST_BASE_URL)，只在隔离环境里由 tests/run-suite.cjs 单独运行
 */
const serverSpecs = process.env.VITEST_SERVER === '1'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: serverSpecs ? ['tests/unit/**/*.server.spec.{js,ts}'] : ['tests/unit/**/*.spec.{js,ts}'],
      exclude: serverSpecs ? ['**/node_modules/**'] : ['**/node_modules/**', 'tests/unit/**/*.server.spec.*'],
      environment: 'node',
      // element-plus 的组件会直接 import 样式文件，交给 Vite 处理，否则 Node 不认识 .css
      server: { deps: { inline: [/element-plus/] } },
      // 测试不应依赖彼此的执行顺序
      sequence: { shuffle: false },
      reporters: ['default'],
    },
  }),
)
