/**
 * 防连点与下拉搜索 (流畅度改进第 1 期)：
 * - useSubmit：上一次提交没结束时再点直接忽略，结束 (包括失败) 后才能再提交。
 * - createIdempotencyKey：每次打开表单生成不同的键。
 * - useStudentSearch：连续输入时只认最后一次搜索的结果，并且每次只取有限条数。
 */
import { describe, expect, it, vi } from 'vitest'

const getStudents = vi.fn()
vi.mock('@/api', () => ({ studentApi: { getStudents: (...args: unknown[]) => getStudents(...args) } }))

import { createIdempotencyKey, useSubmit } from '@/composables/useSubmit'
import { STUDENT_OPTION_LIMIT, useStudentSearch } from '@/composables/useStudentSearch'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useSubmit', () => {
  it('提交进行中再次点击不会再执行一次', async () => {
    const { submitting, submit } = useSubmit()
    const gate = deferred<string>()
    const task = vi.fn(() => gate.promise)

    const first = submit(task)
    const second = submit(task)
    expect(submitting.value).toBe(true)
    expect(task).toHaveBeenCalledTimes(1)
    await expect(second).resolves.toBeUndefined()

    gate.resolve('done')
    await expect(first).resolves.toBe('done')
    expect(submitting.value).toBe(false)
  })

  it('失败后解除锁定，可以重新提交', async () => {
    const { submitting, submit } = useSubmit()
    await expect(submit(() => Promise.reject(new Error('网络错误')))).rejects.toThrow('网络错误')
    expect(submitting.value).toBe(false)
    await expect(submit(async () => 'ok')).resolves.toBe('ok')
  })
})

describe('createIdempotencyKey', () => {
  it('每次生成不同的键，并带上业务前缀', () => {
    const a = createIdempotencyKey('recharge')
    const b = createIdempotencyKey('recharge')
    expect(a).not.toBe(b)
    expect(a.startsWith('recharge-')).toBe(true)
    expect(a.length).toBeLessThanOrEqual(100)
  })
})

describe('useStudentSearch', () => {
  it('只认最后一次输入的搜索结果，并限制每次取的条数', async () => {
    const slow = deferred<any>()
    const fast = deferred<any>()
    getStudents.mockReset()
    getStudents.mockImplementationOnce(() => slow.promise).mockImplementationOnce(() => fast.promise)

    const search = useStudentSearch(() => 'campus-1')
    const p1 = search.search('张')
    const p2 = search.search('张三')
    fast.resolve({ data: { list: [{ id: 's2', name: '张三' }] } })
    await p2
    slow.resolve({ data: { list: [{ id: 's1', name: '张一' }, { id: 's2', name: '张三' }] } })
    await p1

    expect(search.options.value.map((s) => s.id)).toEqual(['s2'])
    expect(search.loading.value).toBe(false)
    expect(getStudents).toHaveBeenLastCalledWith(
      expect.objectContaining({ campusId: 'campus-1', keyword: '张三', pageSize: STUDENT_OPTION_LIMIT }),
    )
  })

  it('校区为「全部」时不按校区过滤', async () => {
    getStudents.mockReset()
    getStudents.mockResolvedValue({ data: [] })
    const search = useStudentSearch(() => 'all')
    await search.search()
    expect(getStudents).toHaveBeenCalledWith(expect.objectContaining({ campusId: undefined, keyword: undefined }))
  })
})
