// @vitest-environment jsdom
/**
 * 后台页面权限矩阵：5 种角色 × 全部后台页面，谁能打开哪个页面 (菜单里显示的也是这一份)。
 *
 * 全程走真实代码：
 *   1. 用种子账号登录真实后端，经由真实的 authStore.loginAsync 拿到角色和权限码
 *   2. 用真实的 router 解析每个页面，再用真实的 canAccessRoute 判断能否打开
 *      (路由守卫、侧边栏、首页入口都用 canAccessRoute)
 *
 * 结果写成 route-access-matrix.md 表格并提交到仓库。之后有人改了路由权限或角色权限，
 * 这个测试会失败并指出哪一格变了；确认是有意修改后，删掉 route-access-matrix.md 再运行
 *   npm run test:all -- --file=route-access-matrix
 * 重新生成表格，和代码一起提交 (PR 里能直接看到哪几格变了)。
 *
 * 需要后端：只在隔离环境里运行 (npm run test:all / test:server)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { BASE_URL } = require('../../server/test-utils/target')
const { ACCOUNTS, SEED_PASSWORD } = require('../../server/test-utils/accounts')

const ROLES = [
  ['superAdmin', '集团超管'],
  ['principal', '执行校长'],
  ['finance', '财务'],
  ['teacher', '任课老师'],
  ['advisor', '课程顾问'],
]

// jsdom 没有实现滚动，路由的 scrollBehavior 会调用它
window.scrollTo = () => {}

// 前端 request 用的是相对路径 (/api/...)，测试里把它指向本次测试的后端
const realFetch = globalThis.fetch
globalThis.fetch = (url, init) => realFetch(new URL(String(url), BASE_URL), init)

let router
let canAccessRoute
let useAuthStore
/** 后台页面 (MainLayout 下有标题的页面)，按路径排序 */
let pages = []
/** role -> { path -> boolean } */
const matrix = {}
/** role -> 登录后的 user (角色、权限码) */
const users = {}

beforeAll(async () => {
  ;({ default: router } = await import('@/router'))
  ;({ canAccessRoute } = await import('@/router/access'))
  ;({ useAuthStore } = await import('@/stores/authStore'))

  const root = router.options.routes.find((r) => r.path === '/')
  pages = root.children
    .filter((c) => c.component && c.meta?.title)
    .map((c) => ({ path: `/${c.path}`, title: c.meta.title, module: c.meta.module || '' }))
    .sort((a, b) => a.path.localeCompare(b.path))

  for (const [key] of ROLES) {
    localStorage.clear()
    setActivePinia(createPinia())
    const store = useAuthStore()
    const { user } = await store.loginAsync(ACCOUNTS[key], SEED_PASSWORD)
    users[key] = user
    matrix[key] = Object.fromEntries(pages.map((p) => [p.path, canAccessRoute(router.resolve(p.path), store)]))
  }
}, 60_000)

function renderMarkdown() {
  const head = `| 页面 | 路径 | ${ROLES.map(([, label]) => label).join(' | ')} |`
  const sep = `|---|---|${ROLES.map(() => ':-:').join('|')}|`
  const rows = pages.map(
    (p) => `| ${p.module ? `${p.module} · ` : ''}${p.title} | \`${p.path}\` | ${ROLES.map(([key]) => (matrix[key][p.path] ? '✓' : '·')).join(' | ')} |`,
  )
  const counts = `| **能打开的页面数** | | ${ROLES.map(([key]) => `**${Object.values(matrix[key]).filter(Boolean).length}**`).join(' | ')} |`
  return [
    '# 后台页面权限矩阵',
    '',
    '由 `tests/unit/route-access-matrix.server.spec.js` 生成：用种子账号登录真实后端，再用真实的路由和 `canAccessRoute` 判断。',
    '✓ = 能打开 (菜单里也显示)，· = 打不开 (菜单里不显示，直接输入地址会回到首页)。',
    '',
    head,
    sep,
    ...rows,
    counts,
    '',
  ].join('\n')
}

describe('后台页面权限矩阵 (5 种角色 × 全部后台页面)', () => {
  it('五个种子账号都能登录，并拿到各自的角色', () => {
    expect(users.superAdmin.roles).toContain('super_admin')
    expect(users.principal.roles).toContain('principal')
    expect(users.finance.roles).toContain('finance')
    expect(users.teacher.roles).toContain('teacher')
    expect(pages.length).toBeGreaterThanOrEqual(19)
  })

  it('权限矩阵与仓库里记录的一致 (route-access-matrix.md)', async () => {
    await expect(renderMarkdown()).toMatchFileSnapshot('./route-access-matrix.md')
  })

  it('集团超管能打开全部后台页面', () => {
    const blocked = pages.filter((p) => !matrix.superAdmin[p.path]).map((p) => p.path)
    expect(blocked).toEqual([])
  })

  it('老师课酬只有校区负责人及以上能打开 (财务、老师、顾问都不行)', () => {
    const pay = '/financial/teacherPay'
    expect(pages.map((p) => p.path)).toContain(pay)
    expect(matrix.superAdmin[pay]).toBe(true)
    expect(matrix.principal[pay]).toBe(true)
    expect(matrix.finance[pay]).toBe(false)
    expect(matrix.teacher[pay]).toBe(false)
    expect(matrix.advisor[pay]).toBe(false)
  })

  it('除控制台看板外，每个后台页面都声明了权限要求 (没有谁都能打开的页面)', () => {
    const root = router.options.routes.find((r) => r.path === '/')
    const open = root.children
      .filter((c) => c.component && c.meta?.title && c.path !== 'dashboard')
      .filter((c) => !c.meta.requiresPermission && !c.meta.requiresLeader)
      .map((c) => `/${c.path}`)
    expect(open).toEqual([])
  })

  it('除超管外，每个角色都至少有一个页面打不开 (权限确实在起作用)', () => {
    for (const [key] of ROLES.slice(1)) {
      expect(Object.values(matrix[key]).some((v) => v === false), key).toBe(true)
    }
  })

  it('侧边栏里的每个菜单项都指向一个真实存在的后台页面', () => {
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../../src/layout/AppSidebar.vue'), 'utf8')
    const block = sidebar.slice(sidebar.indexOf('const MENU_GROUPS'), sidebar.indexOf(']', sidebar.lastIndexOf("path: '/")) + 1)
    const menuPaths = [...block.matchAll(/path: '([^']+)'/g)].map((m) => m[1])
    expect(menuPaths.length).toBeGreaterThan(10)
    const known = new Set(pages.map((p) => p.path))
    expect(menuPaths.filter((p) => !known.has(p))).toEqual([])
  })
})

describe('路由守卫：直接输入地址时的跳转 (真实 router.beforeEach)', () => {
  async function loginAs(key) {
    localStorage.clear()
    setActivePinia(createPinia())
    const store = useAuthStore()
    if (key) await store.loginAsync(ACCOUNTS[key], SEED_PASSWORD)
    return store
  }

  it('没登录时打开后台页面，去登录页并记住原本要去的地址', async () => {
    await loginAs(null)
    await router.push('/financial/orderManagement')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/financial/orderManagement')
  })

  it('财务直接输入老师课酬地址，被送回控制台看板', async () => {
    await loginAs('finance')
    await router.push('/financial/teacherPay')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('执行校长可以打开老师课酬', async () => {
    await loginAs('principal')
    await router.push('/financial/teacherPay')
    expect(router.currentRoute.value.path).toBe('/financial/teacherPay')
  })

  it('任课老师打开财务页面被送回控制台 (或纯教师账号直接进教师端)', async () => {
    const store = await loginAs('teacher')
    await router.push('/financial/orderManagement')
    expect(router.currentRoute.value.path).toBe(store.isTeacherOnly ? '/teacher' : '/dashboard')
  })
})
