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

const MOCK_COURSES: CourseCatalogItem[] = [
  {
    id: 'crs-sf',
    name: '少儿书法',
    subjectName: '百学汇项目',
    gradeName: '三年级',
    pricePerLesson: 54,
    totalLessons: 48,
    totalPrice: 2592,
  },
  {
    id: 'crs-qm',
    name: '启蒙英语',
    subjectName: '百学汇项目',
    gradeName: '一年级',
    pricePerLesson: 64,
    totalLessons: 100,
    totalPrice: 6400,
  },
  {
    id: 'crs-cpp',
    name: 'C++编程集训课',
    subjectName: '012-软编Scratch',
    gradeName: '初一',
    pricePerLesson: 1000,
    totalLessons: 20,
    totalPrice: 20000,
  },
  {
    id: 'crs-py',
    name: 'Python编程集训课',
    subjectName: '012-软编Scratch',
    gradeName: '五年级',
    pricePerLesson: 300,
    totalLessons: 30,
    totalPrice: 9000,
  },
];

const MOCK_GOODS: GoodsCatalogItem[] = [
  {
    id: 'gd-01',
    name: '少儿书法专用毛笔与练习宣纸套装',
    category: '学习用具',
    price: 120,
    unit: '套',
  },
  {
    id: 'gd-02',
    name: '启蒙英语原版绘本与点读笔',
    category: '教材读物',
    price: 260,
    unit: '套',
  },
  {
    id: 'gd-03',
    name: 'Scratch 智能硬件创意拓展盒',
    category: '实验教具',
    price: 350,
    unit: '盒',
  },
];

export const catalogApi = {
  // 1. 获取课程销售目录 (对齐 090)
  async getCourses(params?: {
    keyword?: string;
    grade?: string;
    subject?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CourseCatalogItem[]> {
    try {
      const res = await request<any>({
        url: '/api/curriculum/courses',
        method: 'GET',
        data: {
          pageSize: params?.pageSize || 200,
          ...params,
        },
      });
      const rawList = Array.isArray(res)
        ? res
        : (res && Array.isArray((res as any).list) ? (res as any).list : null);

      if (rawList !== null) {
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
      }
    } catch (e) {
      console.warn('[catalogApi] 获取课程目录失败，回退至内置高保真数据:', e);
    }

    let list = [...MOCK_COURSES];
    if (params?.keyword) {
      const kw = params.keyword.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(kw) || c.subjectName.toLowerCase().includes(kw));
    }
    return list;
  },

  // 2. 获取教具物品目录 (对齐 091)
  async getGoods(params?: { keyword?: string; category?: string }): Promise<GoodsCatalogItem[]> {
    let list = [...MOCK_GOODS];
    if (params?.keyword) {
      const kw = params.keyword.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(kw));
    }
    return list;
  },
};
