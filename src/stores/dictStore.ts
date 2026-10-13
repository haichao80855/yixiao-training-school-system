import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DictItem } from '@/types/system';
import { systemApi } from '@/api';

export const useDictStore = defineStore('dict', () => {
  // 分类字典缓存映射表: category -> DictItem[]
  const dictMap = ref<Record<string, DictItem[]>>({});
  // 加载中状态
  const loadingMap = ref<Record<string, boolean>>({});

  /**
   * 加载指定分类的字典项（优先读取前端内存缓存）
   */
  async function loadDict(category: string, force = false): Promise<DictItem[]> {
    if (!force && dictMap.value[category] && dictMap.value[category].length > 0) {
      return dictMap.value[category];
    }

    loadingMap.value[category] = true;
    try {
      const res = await systemApi.getDictItems(category);
      if (res && res.success && Array.isArray(res.data)) {
        dictMap.value[category] = res.data;
        return res.data;
      }
      return dictMap.value[category] || [];
    } catch (err) {
      console.error(`加载字典 [${category}] 失败:`, err);
      return dictMap.value[category] || [];
    } finally {
      loadingMap.value[category] = false;
    }
  }

  /**
   * 获取指定分类下所有启用的字典项
   */
  function getEnabledItems(category: string): DictItem[] {
    const list = dictMap.value[category] || [];
    return list.filter((item) => item.enabled);
  }

  /**
   * 根据分类和 dictKey 获取字典显示标签 (Label)
   */
  function getDictLabel(category: string, dictKey: string): string {
    const list = dictMap.value[category] || [];
    const found = list.find((item) => item.dictKey === dictKey);
    return found ? found.label : dictKey;
  }

  /**
   * 清除特定分类或全量前端缓存
   */
  function clearDictCache(category?: string) {
    if (category) {
      delete dictMap.value[category];
    } else {
      dictMap.value = {};
    }
  }

  return {
    dictMap,
    loadingMap,
    loadDict,
    getEnabledItems,
    getDictLabel,
    clearDictCache,
  };
});
