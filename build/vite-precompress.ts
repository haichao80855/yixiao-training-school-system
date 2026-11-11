import type { Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'

/**
 * 构建后为静态资源生成 .gz / .br 预压缩文件，供 Nginx gzip_static / brotli_static 直接发送，
 * 避免每次请求现场压缩 (不引入额外依赖，只用 Node 自带 zlib)。
 */
export function precompress(): Plugin {
  let outDir = 'dist'
  return {
    name: 'yixiao-precompress',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name)
          return e.isDirectory() ? walk(p) : [p]
        })
      if (!fs.existsSync(outDir)) return
      for (const file of walk(outDir)) {
        if (!/\.(js|mjs|css|html|svg|json)$/.test(file)) continue
        const buf = fs.readFileSync(file)
        if (buf.length < 1024) continue
        fs.writeFileSync(`${file}.gz`, zlib.gzipSync(buf, { level: 9 }))
        fs.writeFileSync(
          `${file}.br`,
          zlib.brotliCompressSync(buf, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
            },
          }),
        )
      }
    },
  }
}
