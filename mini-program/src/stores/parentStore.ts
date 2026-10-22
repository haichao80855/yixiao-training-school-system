import { defineStore } from 'pinia';
import { parentApi, ParentChild } from '../api/parent';

const CHILDREN_KEY = 'parentChildren';
const CURRENT_KEY = 'parentCurrentStudentId';
const PHONE_KEY = 'parentPhoneMasked';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = uni.getStorageSync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 家长端：子女列表与当前查看的子女 (切换后各页面按 currentStudentId 重新加载)
 */
export const useParentStore = defineStore('parent', {
  state: () => ({
    children: readJson<ParentChild[]>(CHILDREN_KEY, []),
    currentStudentId: (uni.getStorageSync(CURRENT_KEY) || '') as string,
    phoneMasked: (uni.getStorageSync(PHONE_KEY) || '') as string,
  }),
  getters: {
    currentChild(state): ParentChild | null {
      return state.children.find((c) => c.studentId === state.currentStudentId) || state.children[0] || null;
    },
    isReadOnly(): boolean {
      return this.currentChild?.access === 'read_only';
    },
  },
  actions: {
    hydrate(data: { children: ParentChild[]; currentStudentId: string | null; phoneMasked?: string }) {
      this.children = data.children;
      const valid = data.children.some((c) => c.studentId === data.currentStudentId);
      this.currentStudentId = valid ? (data.currentStudentId as string) : data.children[0]?.studentId || '';
      if (data.phoneMasked) this.phoneMasked = data.phoneMasked;
      uni.setStorageSync(CHILDREN_KEY, JSON.stringify(this.children));
      uni.setStorageSync(CURRENT_KEY, this.currentStudentId);
      uni.setStorageSync(PHONE_KEY, this.phoneMasked);
    },
    /** 刷新子女列表 (离校学员可能已过只读期) */
    async refresh() {
      const me = await parentApi.me();
      this.hydrate({ children: me.children, currentStudentId: this.currentStudentId || me.currentStudentId, phoneMasked: me.account.phoneMasked });
      return me;
    },
    async switchChild(studentId: string) {
      if (studentId === this.currentStudentId) return;
      this.currentStudentId = studentId;
      uni.setStorageSync(CURRENT_KEY, studentId);
      // 记住本会话上次查看的孩子；失败不影响切换
      parentApi.setCurrentChild(studentId).catch(() => undefined);
    },
    clear() {
      this.children = [];
      this.currentStudentId = '';
      this.phoneMasked = '';
      uni.removeStorageSync(CHILDREN_KEY);
      uni.removeStorageSync(CURRENT_KEY);
      uni.removeStorageSync(PHONE_KEY);
    },
  },
});
