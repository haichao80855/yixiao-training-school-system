import { computed, onMounted } from 'vue';
import { useDictStore } from '@/stores/dictStore';
import type { DictItem } from '@/types/system';

export function useDict(category: string) {
  const dictStore = useDictStore();

  const loading = computed(() => Boolean(dictStore.loadingMap[category]));
  const items = computed<DictItem[]>(() => dictStore.getEnabledItems(category));

  onMounted(() => {
    dictStore.loadDict(category);
  });

  function getLabel(dictKey: string): string {
    return dictStore.getDictLabel(category, dictKey);
  }

  function refresh() {
    return dictStore.loadDict(category, true);
  }

  return {
    items,
    loading,
    getLabel,
    refresh,
  };
}
