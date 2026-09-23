import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TagViewItem } from '@/types'

export const useTagsViewStore = defineStore('tagsView', () => {
  const visitedViews = ref<TagViewItem[]>([
    {
      name: 'Dashboard',
      path: '/dashboard',
      fullPath: '/dashboard',
      title: '控制台看板',
      affix: true
    }
  ])

  function addVisitedView(view: TagViewItem) {
    if (visitedViews.value.some(v => v.path === view.path)) return
    visitedViews.value.push({
      name: view.name,
      path: view.path,
      fullPath: view.fullPath || view.path,
      title: view.title || '无标题',
      affix: view.affix || false
    })
  }

  function delVisitedView(view: TagViewItem): TagViewItem[] {
    visitedViews.value = visitedViews.value.filter(v => v.path !== view.path || v.affix)
    return visitedViews.value
  }

  function delOthersViews(view: TagViewItem): TagViewItem[] {
    visitedViews.value = visitedViews.value.filter(v => v.path === view.path || v.affix)
    return visitedViews.value
  }

  function delAllViews(): TagViewItem[] {
    visitedViews.value = visitedViews.value.filter(v => v.affix)
    return visitedViews.value
  }

  return {
    visitedViews,
    addVisitedView,
    delVisitedView,
    delOthersViews,
    delAllViews
  }
})
