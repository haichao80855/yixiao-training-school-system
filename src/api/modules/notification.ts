import { request } from '@/utils/request'

export interface StaffNotification {
  id: string
  campusId: string
  /** evaluation_published (课评发布) | low_balance (课时不足) */
  type: string
  title: string
  content: string
  link: string | null
  createdAt: string
  read: boolean
}

export interface StaffNotificationList {
  /** 当前账号能否收到通知 (校区负责人及以上) */
  enabled: boolean
  items: StaffNotification[]
  unreadCount: number
}

/** 后台顶部铃铛里的站内通知 */
export const notificationApi = {
  list: (limit = 20) => request<StaffNotificationList>('/api/notifications', { params: { limit } }),
  markRead: (id: string) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<{ count: number }>('/api/notifications/read-all', { method: 'POST' }),
}
