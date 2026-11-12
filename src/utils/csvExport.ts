import { toDateKey } from './dateKey'

/**
 * 前端导出 CSV：用已有的列表接口取数后在浏览器生成文件，不经过后端，也不引入表格库。
 * 文件带 UTF-8 BOM，Excel 直接双击打开不会出现中文乱码。
 */
export interface CsvColumn<T> {
  title: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  let text = String(raw)
  // 防止 Excel 把 = + - @ 开头的内容当公式执行
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCell(c.title)).join(',')
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

/** 文件名里的日期，如 2026-11-12 */
export function todayStamp(date = new Date()): string {
  return toDateKey(date)
}

export function downloadCsv<T>(fileName: string, columns: CsvColumn<T>[], rows: T[]): void {
  const blob = new Blob(['\uFEFF', buildCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
