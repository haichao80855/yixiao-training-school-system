import { defineStore } from 'pinia';
import { request } from '../utils/request';

export interface CampusItem {
  id: string;
  name: string;
  code: string;
  isHeadquarter?: boolean;
}

export const useCampusStore = defineStore('campus', {
  state: () => ({
    campuses: [] as CampusItem[],
    currentCampusId: (uni.getStorageSync('currentCampusId') || 'all') as string,
    currentCampusName: (uni.getStorageSync('currentCampusName') || '全部校区') as string,
  }),
  getters: {
    availableCampuses(state): CampusItem[] {
      const allOption: CampusItem = { id: 'all', name: '全部校区', code: 'ALL' };
      if (state.campuses && state.campuses.length > 0) {
        return [allOption, ...state.campuses];
      }
      return [
        allOption,
        { id: 'campus-bj-hq', name: '总部乐博旗舰校区', code: 'campus-bj-hq', isHeadquarter: true },
        { id: 'campus-bj-yy', name: '远洋学习中心', code: 'campus-bj-yy', isHeadquarter: false },
        { id: 'campus-bj-cy', name: '朝阳大悦城校区', code: 'campus-bj-cy', isHeadquarter: false },
        { id: 'campus-bj-hd', name: '海淀黄庄校区', code: 'campus-bj-hd', isHeadquarter: false },
        { id: 'campus-bj-wj', name: '望京科技园校区', code: 'campus-bj-wj', isHeadquarter: false },
      ];
    },
  },
  actions: {
    async fetchCampuses() {
      try {
        const list = await request<CampusItem[]>({ url: '/api/system/campuses' });
        if (Array.isArray(list) && list.length > 0) {
          this.campuses = list;
          if (this.currentCampusId === 'all') {
            this.currentCampusName = '全部校区';
          } else {
            const current = list.find((c) => c.id === this.currentCampusId);
            if (current) {
              this.currentCampusName = current.name;
            } else {
              this.currentCampusId = 'all';
              this.currentCampusName = '全部校区';
              uni.setStorageSync('currentCampusId', 'all');
              uni.setStorageSync('currentCampusName', '全部校区');
            }
          }
        }
      } catch (e) {
        console.warn('获取校区列表异常:', e);
      }
    },
    setCampus(campus: CampusItem) {
      this.currentCampusId = campus.id;
      this.currentCampusName = campus.name;
      uni.setStorageSync('currentCampusId', campus.id);
      uni.setStorageSync('currentCampusName', campus.name);
      uni.$emit('campus-changed', campus.id);
    },
    switchCampus(campusId: string) {
      const target = this.availableCampuses.find((c) => c.id === campusId);
      if (target) {
        this.setCampus(target);
      }
    },
  },
});
