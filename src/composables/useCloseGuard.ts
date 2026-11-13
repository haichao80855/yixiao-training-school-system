import { ElMessageBox } from 'element-plus'

/**
 * 长表单弹窗的防误关：填了内容还没提交时，按 Esc、点右上角关闭会先确认，不会一下子丢掉。
 * 用法：<el-dialog :before-close="beforeClose">，const beforeClose = useCloseGuard(() => 表单是否填过内容)
 * 「取消」按钮是明确的操作，不经过这里。
 */
export function useCloseGuard(isDirty: () => boolean, message = '填写的内容还没有保存，确定关闭吗？') {
  return (done: () => void) => {
    if (!isDirty()) {
      done()
      return
    }
    ElMessageBox.confirm(message, '关闭确认', {
      type: 'warning',
      confirmButtonText: '关闭',
      cancelButtonText: '继续填写',
    }).then(
      () => done(),
      () => undefined,
    )
  }
}
