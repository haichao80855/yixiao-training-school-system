import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const KEYBOARD_MIN_HEIGHT = 120;

function focusedEditable(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return null;
  if (el.tagName === 'TEXTAREA' || el.isContentEditable) return el;
  if (el.tagName === 'INPUT' && !['file', 'checkbox', 'radio'].includes((el as HTMLInputElement).type)) return el;
  return null;
}

/** body 虽然 overflow: hidden，仍可能被 iOS 或脚本滚动：外壳已贴合可见区域，文档不应有任何偏移 */
function resetDocumentScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** 把输入框滚到可见区中部。只滚动 main，不用 scrollIntoView：它会连带滚动外层文档，把顶部标题栏顶出屏幕 */
function revealEditable(editable: HTMLElement) {
  const main = editable.closest('main');
  if (!main) {
    // 弹窗里的输入框不在 main 内，由弹窗遮罩层滚动
    editable.scrollIntoView({ block: 'center' });
    return;
  }
  const box = editable.getBoundingClientRect();
  const view = main.getBoundingClientRect();
  // 比可见区还高的输入框对齐顶部，保证光标附近可见
  const offset = box.height >= view.height ? box.top - view.top : box.top + box.height / 2 - (view.top + view.height / 2);
  main.scrollBy({ top: offset });
}

/**
 * 软键盘适配：iOS 弹键盘时布局高度不变，贴底内容会被盖住。
 * 键盘打开时把外壳高度收缩到可见区域，并把正在输入的控件滚回可见范围。
 */
export function useKeyboardViewport() {
  const keyboardOpen = ref(false);
  const shellHeight = ref<number | null>(null);
  let baseHeight = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  function update() {
    const vv = window.visualViewport;
    // 双指放大时可见区域也会变小，不能误判为键盘
    if (!vv || vv.scale > 1.01) return;

    const editable = focusedEditable();
    if (!editable) baseHeight = vv.height;
    else baseHeight = Math.max(baseHeight, vv.height);

    const isOpen = !!editable && baseHeight - vv.height > KEYBOARD_MIN_HEIGHT;
    const justOpened = isOpen && !keyboardOpen.value;
    keyboardOpen.value = isOpen;
    shellHeight.value = isOpen ? vv.height : null;

    // 等外壳高度真正应用到 DOM 后再调整滚动
    nextTick(() => {
      if (justOpened && editable) revealEditable(editable);
      resetDocumentScroll();
    });
  }

  // 焦点切换时键盘尺寸还在动画中，稍后再算一次
  function settle() {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(update, 150);
  }

  onMounted(() => {
    baseHeight = window.visualViewport?.height ?? window.innerHeight;
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('focusin', settle);
    window.addEventListener('focusout', settle);
  });

  onBeforeUnmount(() => {
    if (settleTimer) clearTimeout(settleTimer);
    window.visualViewport?.removeEventListener('resize', update);
    window.removeEventListener('focusin', settle);
    window.removeEventListener('focusout', settle);
  });

  return { keyboardOpen, shellHeight };
}
