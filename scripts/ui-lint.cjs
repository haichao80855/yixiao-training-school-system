#!/usr/bin/env node
/**
 * UI 规范防回退检查 (npm run lint:ui)
 *
 * 统计几类不符合设计规范的写法，数量只许减少不许增加：
 * - 后台小于 12px 的文字 (Tailwind text-[9/10/11px] 或 CSS font-size < 12px)
 * - 家长端 (含登录页) 小于 24rpx (12px) 的字号
 * - 家长端 32rpx 及以下没走 p-fs() 的字号 (窄屏上会缩到 12px 以下；家长端不能双指放大)
 * - 家长端写死的十六进制颜色 (应改用 package-parent/styles/tokens.scss 里的变量)
 * - 绕过设计令牌的 Tailwind 原色类 (text/bg/border/divide-gray|blue|amber...-500 等，应改用 st-* 令牌)
 * - 写死的十六进制颜色 (var(--x, #fff) 里的兜底值不算；学员头像插画色板除外)
 * - 页面里引用 @element-plus/icons-vue (图标统一用 lucide-vue-next)
 *
 * 上限记录在下方 LIMITS。某一项降下来以后，把上限一起调低，防止回退。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const LIMITS = {
  adminTextUnder12px: 0,
  parentFontUnder24rpx: 0,
  parentFontWithoutFloor: 0,
  parentHexColors: 58, // 家长端 UI 改进第 3 期降到 0
  rawPaletteClasses: 35,
  rawHexColors: 3,
  elementPlusIconImports: 0,
}

/** 设计稿插画色板，允许写死颜色 */
const HEX_ALLOWLIST = new Set(['src/components/StudentAvatar.vue'])

function listFiles(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, exts, out)
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

const rel = (file) => path.relative(ROOT, file)
const counts = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, 0]))
const examples = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, []]))

function hit(key, file, text, index) {
  counts[key]++
  if (examples[key].length < 5) {
    const line = text.slice(0, index).split('\n').length
    examples[key].push(`${rel(file)}:${line}`)
  }
}

const PALETTE_RE =
  /(?<![\w-])(?:[a-z0-9-]+:)*!?(?:text|bg|border(?:-[trblxy])?|divide)-(?:gray|slate|zinc|neutral|stone|blue|indigo|sky|amber|orange|yellow|emerald|green|teal|red|rose|pink|purple|violet|fuchsia)-\d{2,3}(?:\/\d+)?(?![\w-])/g
const SMALL_TW_RE = /(?<![\w-])text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/g
const SMALL_CSS_PX_RE = /font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/g
const SMALL_RPX_RE = /font-size:\s*(\d+(?:\.\d+)?)rpx/g
const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g

for (const file of listFiles(path.join(ROOT, 'src'), ['.vue', '.ts', '.css'])) {
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(SMALL_TW_RE)) hit('adminTextUnder12px', file, text, m.index)
  for (const m of text.matchAll(SMALL_CSS_PX_RE)) hit('adminTextUnder12px', file, text, m.index)
  if (file.endsWith('.css')) continue
  for (const m of text.matchAll(PALETTE_RE)) hit('rawPaletteClasses', file, text, m.index)
  if (file.endsWith('.vue') && !HEX_ALLOWLIST.has(rel(file))) {
    for (const m of text.matchAll(HEX_RE)) {
      // var(--token, #fff) 里的兜底值不算
      const before = text.slice(Math.max(0, m.index - 80), m.index)
      if (/var\(--[\w-]+,\s*$/.test(before)) continue
      // #fff / #000 这种纯黑白不算
      if (/^#(?:fff|ffffff|000|000000)$/i.test(m[0])) continue
      hit('rawHexColors', file, text, m.index)
    }
  }
  for (const m of text.matchAll(/from\s+'@element-plus\/icons-vue'/g)) hit('elementPlusIconImports', file, text, m.index)
}

const PARENT_FS_RE = /font-size:\s*p-fs\((\d+(?:\.\d+)?)\)/g
const PARENT_FILES = [
  ...listFiles(path.join(ROOT, 'mini-program/src/package-parent'), ['.vue', '.scss']),
  path.join(ROOT, 'mini-program/src/pages/login/index.vue'),
]
for (const file of PARENT_FILES) {
  const text = fs.readFileSync(file, 'utf8')
  const isParentPkg = file.includes(`${path.sep}package-parent${path.sep}`)
  for (const m of text.matchAll(SMALL_RPX_RE)) {
    if (Number(m[1]) < 24) hit('parentFontUnder24rpx', file, text, m.index)
    // tokens.scss 里 p-fs() 自身的实现除外
    else if (isParentPkg && Number(m[1]) <= 32 && !file.endsWith('tokens.scss')) hit('parentFontWithoutFloor', file, text, m.index)
  }
  for (const m of text.matchAll(PARENT_FS_RE)) {
    if (Number(m[1]) < 24) hit('parentFontUnder24rpx', file, text, m.index)
  }
  for (const m of text.matchAll(SMALL_CSS_PX_RE)) hit('parentFontUnder24rpx', file, text, m.index)
  if (isParentPkg && file.endsWith('.vue')) {
    for (const m of text.matchAll(HEX_RE)) {
      if (/^#(?:fff|ffffff|000|000000)$/i.test(m[0])) continue
      hit('parentHexColors', file, text, m.index)
    }
  }
}

let failed = false
console.log('UI 规范检查 (当前数量 / 上限)')
for (const [key, limit] of Object.entries(LIMITS)) {
  const over = counts[key] > limit
  if (over) failed = true
  console.log(`  ${over ? '✗' : '✓'} ${key}: ${counts[key]} / ${limit}`)
  if (over) for (const ex of examples[key]) console.log(`      ${ex}`)
}
if (failed) {
  console.error('\n有项目超过上限：请改用 st-* 设计令牌、12px 以上的字号、lucide 图标，或说明理由后再调整 LIMITS。')
  process.exit(1)
}
const lowered = Object.entries(LIMITS).filter(([key, limit]) => counts[key] < limit)
if (lowered.length) {
  console.log(`\n以下项目已低于上限，可以把 LIMITS 调低：${lowered.map(([k]) => `${k}=${counts[k]}`).join('，')}`)
}
