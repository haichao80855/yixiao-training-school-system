import { request } from '../utils/request';

export interface CourseCatalogItem {
  id: string;
  name: string;
  subjectName: string;
  gradeName?: string;
  pricePerLesson: number;
  totalLessons: number;
  totalPrice: number;
  coverUrl?: string;
  bonusLessons?: number;
  discountAmount?: number;
}

export interface GoodsCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  coverUrl?: string;
}

export const catalogApi = {
  // 1. 获取课程销售目录 (对齐 090)
  async getCourses(params?: {
    keyword?: string;
    grade?: string;
    subject?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CourseCatalogItem[]> {
    const res = await request<any>({
      url: '/api/curriculum/courses',
      method: 'GET',
      data: {
        pageSize: params?.pageSize || 200,
        ...params,
      },
    });
    const rawList: any[] = Array.isArray(res) ? res : (Array.isArray((res as any)?.list) ? (res as any).list : []);
    let list: CourseCatalogItem[] = rawList.map((c: any) => {
      const pricePerLesson = c.unitPrice ?? c.pricePerLesson ?? 64;
      const totalLessons = c.totalLessons ?? 48;
      const totalPrice = c.totalPrice ?? (pricePerLesson * totalLessons);
      return {
        id: c.id,
        name: c.name,
        subjectName: c.subject || c.subjectName || '综合科目',
        gradeName: c.grade || c.gradeName || '通用年级',
        pricePerLesson,
        totalLessons,
        totalPrice,
        coverUrl: c.coverUrl,
      };
    });
    if (params?.keyword) {
      const kw = params.keyword.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(kw) || c.subjectName.toLowerCase().includes(kw));
    }
    return list;
  },

  // 2. 获取教具物品目录 (对齐 091)
  // 后端尚无物品目录接口，在接口落地前返回空目录，不展示虚构商品
  async getGoods(_params?: { keyword?: string; category?: string }): Promise<GoodsCatalogItem[]> {
    return [];
  },
};
