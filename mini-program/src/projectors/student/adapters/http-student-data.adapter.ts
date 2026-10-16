import { request } from '../../../utils/request';
import type { StudentDataPort } from '../ports';
import type { RosterQuery } from '../types';

/**
 * 生产网络适配器 (HTTP Student Data Adapter)
 * 对接服务端 RESTful 业务端点
 */
export class HttpStudentDataAdapter implements StudentDataPort {
  async fetchStudents(query?: RosterQuery): Promise<{ list: any[]; total: number }> {
    try {
      const backendQuery: any = { ...query };
      // pending_assignment、in_class、graduated、not_enrolled 是端侧学籍状态机综合投影，服务端 DB 不含此类虚拟枚举
      // 为保证拉取候选集并在端侧精确投影归一化，将虚拟状态剥离，并转换特定映射状态 (如 lost -> dropped_out)
      const virtualStatuses = ['pending_assignment', 'in_class', 'graduated', 'not_enrolled', 'all', '全部状态'];
      if (backendQuery.status) {
        if (virtualStatuses.includes(backendQuery.status)) {
          delete backendQuery.status;
        } else if (backendQuery.status === 'lost') {
          backendQuery.status = 'dropped_out';
        }
      }

      if (!backendQuery.pageSize || backendQuery.pageSize < 100) {
        backendQuery.pageSize = 100;
      }

      const res = await request<any>({
        url: '/api/students',
        method: 'GET',
        data: backendQuery,
      });

      const list = res?.list || res?.items || (Array.isArray(res) ? res : []);
      const total = Number(res?.total ?? list.length);
      return { list, total };
    } catch (err) {
      console.warn('[HttpStudentDataAdapter] fetchStudents 网络异常，降级为空列表:', err);
      return { list: [], total: 0 };
    }
  }

  async fetchStudentProfile(studentId: string): Promise<any> {
    try {
      const res = await request<any>({
        url: `/api/students/${studentId}/profile`,
        method: 'GET',
      });
      return res;
    } catch (err) {
      console.warn(`[HttpStudentDataAdapter] fetchStudentProfile(${studentId}) 网络异常:`, err);
      throw err;
    }
  }
}
