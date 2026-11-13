import { ref } from 'vue'

/**
 * 提交按钮的防连点与加载状态。
 *
 * 用法：
 *   const { submitting, submit } = useSubmit()
 *   async function handleSave() {
 *     await submit(async () => { await api.save(...); ElMessage.success('已保存') })
 *   }
 *   <el-button :loading="submitting" @click="handleSave">保存</el-button>
 *
 * - 上一次提交还没结束时，再点会被直接忽略 (不发第二个请求)，适用于充值、审批、消课等不能重复的操作。
 * - 按钮绑定 :loading="submitting"，用户点下去立刻能看到反馈。
 * - 错误由传入的函数自己处理 (弹提示)；没处理的错误会继续抛出。
 */
export function useSubmit() {
  const submitting = ref(false)

  async function submit<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (submitting.value) return undefined
    submitting.value = true
    try {
      return await task()
    } finally {
      submitting.value = false
    }
  }

  return { submitting, submit }
}

/**
 * 生成一次操作的幂等键。在「打开表单」时生成一次，这次操作的重试和连点都用同一个键，
 * 后端据此保证同一笔充值 / 提现只执行一次。
 */
export function createIdempotencyKey(scope: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return `${scope}-${random}`
}
