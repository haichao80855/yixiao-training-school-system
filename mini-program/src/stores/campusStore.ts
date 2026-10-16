import { defineStore } from 'pinia';
import { request } from '../utils/request';

export interface CampusItem {
  id: string;
  name: string;
  code: string;
  isHeadquarter?: boolean;
}

const SINGLE_CAMPUS: CampusItem = {
  id: 'campus-bj-hq',
  name: '拓视未来-原阳校区',
  code: 'campus-bj-hq',
  isHeadquarter: true,
};

export const useCampusStore = defineStore('campus', {
  state: () => ({
    campuses: [SINGLE_CAMPUS] as CampusItem[],
    currentCampusId: (uni.getStorageSync('currentCampusId') || SINGLE_CAMPUS.id) as string,
    currentCampusName: (uni.getStorageSync('currentCampusName') || SINGLE_CAMPUS.name) as string,
  }),
  getters: {
    availableCampuses(): CampusItem[] {
      return [SINGLE_CAMPUS];
    },
  },
  actions: {
    async fetchCampuses() {
      try {
        const list = await request<CampusItem[]>({ url: '/api/system/campuses' });
        const matched = Array.isArray(list) ? list.find((c) => c.name?.includes('原阳') || c.id === 'campus-bj-hq') : null;
        this.campuses = [
          {
            id: matched?.id || SINGLE_CAMPUS.id,
            name: '拓视未来-原阳校区',
            code: matched?.code || SINGLE_CAMPUS.code,
            isHeadquarter: true,
          },
        ];
        this.currentCampusId = this.campuses[0].id;
        this.currentCampusName = this.campuses[0].name;
        uni.setStorageSync('currentCampusId', this.currentCampusId);
        uni.setStorageSync('currentCampusName', this.currentCampusName);
      } catch (e) {
        console.warn('获取校区列表异常:', e);
        this.campuses = [SINGLE_CAMPUS];
        this.currentCampusId = SINGLE_CAMPUS.id;
        this.currentCampusName = SINGLE_CAMPUS.name;
      }
    },
    setCampus(campus: CampusItem) {
      this.currentCampusId = campus.id || SINGLE_CAMPUS.id;
      this.currentCampusName = campus.name || SINGLE_CAMPUS.name;
      uni.setStorageSync('currentCampusId', this.currentCampusId);
      uni.setStorageSync('currentCampusName', this.currentCampusName);
      uni.$emit('campus-changed', this.currentCampusId);
    },
    switchCampus(campusId: string) {
      this.setCampus(SINGLE_CAMPUS);
    },
  },
});
