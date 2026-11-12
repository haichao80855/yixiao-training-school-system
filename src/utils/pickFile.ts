/**
 * 打开系统文件选择框，返回用户选中的文件；用户取消时返回 null。
 * 用于把“点击上传”区域接到真实文件，而不是在页面里放隐藏的 input。
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    let settled = false
    const finish = (file: File | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    // 较新的浏览器在取消选择时会触发 cancel
    input.addEventListener('cancel', () => finish(null))
    document.body.appendChild(input)
    input.click()
  })
}

/** 图片大小上限 (与后端照片上传的 10MB 上限一致，调用方可传更小的值) */
export function checkFileSize(file: File, maxMb: number): string | null {
  if (file.size > maxMb * 1024 * 1024) {
    return `文件「${file.name}」超过 ${maxMb}MB，请压缩后再上传`
  }
  return null
}
