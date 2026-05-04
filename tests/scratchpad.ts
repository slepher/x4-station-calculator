// tests/scratchpad.ts
// CLI 测试脚本 - 测试 Store 逻辑

import { createSSRApp, defineComponent, h, Suspense } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uiEn from '@/locales/en.json'

// Mock localStorage（Node 环境没有）
const store: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  length: Object.keys(store).length,
  key: (index: number) => Object.keys(store)[index] || null,
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  globalInjection: true,
  messages: { en: uiEn }
})

const pinia = createPinia()

// 测试组件
const TestRunner = defineComponent({
  name: 'TestRunner',
  async setup() {
    console.log('--- Test started ---')

    const { useGameDataStore } = await import('@/store/useGameDataStore')
    const gameStore = useGameDataStore()

    console.log('Before initialize:')
    console.log('  isReady:', gameStore.isReady)
    console.log('  modulesMap size:', Object.keys(gameStore.modulesMap).length)

    await gameStore.initialize()

    console.log('\nAfter initialize:')
    console.log('  isReady:', gameStore.isReady)
    console.log('  modulesMap size:', Object.keys(gameStore.modulesMap).length)
    console.log('  waresMap size:', Object.keys(gameStore.waresMap).length)
    console.log('  current version:', gameStore.currentVersion)

    console.log('\n✅ Test complete')

    return () => h('div')
  }
})

// Wrapper with Suspense for async setup
const App = defineComponent({
  name: 'App',
  setup() {
    return () => h(Suspense, {}, {
      default: () => h(TestRunner)
    })
  }
})

async function main() {
  const app = createSSRApp(App)
  app.use(pinia)
  app.use(i18n)

  try {
    await renderToString(app)
  } catch (error) {
    console.error('[renderToString] Failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)