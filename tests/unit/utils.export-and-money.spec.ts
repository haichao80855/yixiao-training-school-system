// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCsv, downloadCsv, todayStamp, type CsvColumn } from '@/utils/csvExport'
import { formatYuan } from '@/api/modules/teacherPay'
import { useLoadState } from '@/composables/useLoadState'

interface Row {
  name: string
  amount: number | null
  note?: string
}
const columns: CsvColumn<Row>[] = [
  { title: '老师', value: (r) => r.name },
  { title: '合计 (元)', value: (r) => r.amount },
  { title: '备注', value: (r) => r.note },
]

describe('csvExport：导出 CSV (订单、课酬等页面共用)', () => {
  it('表头 + 数据行，行之间用 CRLF (Excel 兼容)', () => {
    expect(buildCsv(columns, [{ name: '孙晨', amount: 575 }])).toBe('老师,合计 (元),备注\r\n孙晨,575,')
  })

  it('含逗号、双引号、换行的内容加引号，双引号转义', () => {
    const csv = buildCsv(columns, [{ name: '赵立鹏', amount: 1, note: '周六,周日 "加课"\n补' }])
    expect(csv.split('\r\n')[1]).toBe('赵立鹏,1,"周六,周日 ""加课""\n补"')
  })

  it('以 = + - @ 开头的内容加单引号，防止 Excel 当作公式执行', () => {
    const csv = buildCsv(columns, [{ name: '=HYPERLINK("http://x")', amount: -20, note: '@SUM(A1)' }])
    const [name, amount, note] = csv.split('\r\n')[1].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    expect(name.startsWith(`"'=`) || name.startsWith(`'=`)).toBe(true)
    expect(amount).toBe(`'-20`)
    expect(note).toBe(`'@SUM(A1)`)
  })

  it('空值导出为空单元格，0 原样导出', () => {
    expect(buildCsv(columns, [{ name: '', amount: 0, note: undefined }]).split('\r\n')[1]).toBe(',0,')
    expect(buildCsv(columns, [{ name: 'x', amount: null }]).split('\r\n')[1]).toBe('x,,')
  })

  it('没有数据时只有表头', () => {
    expect(buildCsv(columns, [])).toBe('老师,合计 (元),备注')
  })

  it('todayStamp 是 yyyy-mm-dd', () => {
    expect(todayStamp(new Date(2026, 9, 1))).toBe('2026-10-01')
  })

  describe('downloadCsv', () => {
    afterEach(() => vi.restoreAllMocks())

    it('生成带 UTF-8 BOM 的文件 (Excel 打开中文不乱码)，文件名自动补 .csv', async () => {
      let blob: Blob | undefined
      URL.createObjectURL = vi.fn((b: Blob) => {
        blob = b
        return 'blob:test'
      }) as any
      URL.revokeObjectURL = vi.fn()
      let downloadName = ''
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloadName = this.download
      })

      downloadCsv('老师课酬-2026-10', columns, [{ name: '孙晨', amount: 575 }])

      expect(downloadName).toBe('老师课酬-2026-10.csv')
      const buffer = await new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.readAsArrayBuffer(blob!)
      })
      const bytes = new Uint8Array(buffer)
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
      expect(new TextDecoder().decode(bytes.slice(3))).toBe('老师,合计 (元),备注\r\n孙晨,575,')
      expect(document.querySelectorAll('a').length).toBe(0) // 临时链接已移除
    })
  })
})

describe('formatYuan：金额按分存储，显示时换算成元', () => {
  it('分换算成元，固定两位小数', () => {
    expect(formatYuan(57500)).toBe('575.00')
    expect(formatYuan(35905)).toBe('359.05')
    expect(formatYuan(1)).toBe('0.01')
    expect(formatYuan(0)).toBe('0.00')
  })

  it('大额带千分位；负数保留负号', () => {
    expect(formatYuan(123456789)).toBe('1,234,567.89')
    expect(formatYuan(-2000)).toBe('-20.00')
  })
})

describe('useLoadState：列表加载中、加载失败的状态', () => {
  it('成功：加载中 → 结束，没有错误', async () => {
    const { loading, loadError, track } = useLoadState()
    let resolve!: () => void
    const p = track(() => new Promise<void>((r) => (resolve = r)))
    expect(loading.value).toBe(true)
    resolve()
    await p
    expect(loading.value).toBe(false)
    expect(loadError.value).toBe('')
  })

  it('失败：显示错误原因 (而不是空表格的「暂无数据」)', async () => {
    const { loading, loadError, track } = useLoadState()
    await track(async () => {
      throw new Error('只有校区负责人及以上可以查看老师课酬')
    })
    expect(loading.value).toBe(false)
    expect(loadError.value).toBe('只有校区负责人及以上可以查看老师课酬')
  })

  it('断网时浏览器抛出的英文 TypeError 换成中文说明', async () => {
    const { loadError, track } = useLoadState()
    await track(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(loadError.value).toBe('网络连接失败，请检查网络后重新加载')
  })

  it('没有错误信息时用默认提示；重新加载时清除上次的错误', async () => {
    const { loadError, track, fail } = useLoadState()
    fail({}, '获取列表失败')
    expect(loadError.value).toBe('获取列表失败')
    await track(async () => {})
    expect(loadError.value).toBe('')
  })

  it('连续触发时只有最后一次请求决定结果 (先发的慢请求不会覆盖)', async () => {
    const { loading, loadError, track } = useLoadState()
    let rejectFirst!: (e: Error) => void
    const first = track(() => new Promise<void>((_, rej) => (rejectFirst = rej)))
    const second = track(async () => {})
    await second
    // 最后一次请求已结束 → 加载状态结束，即使先发的请求还没回来
    expect(loading.value).toBe(false)
    rejectFirst(new Error('旧请求失败'))
    await first
    // 旧请求后来失败了，也不会把错误显示到新结果上
    expect(loadError.value).toBe('')
    expect(loading.value).toBe(false)
  })
})
