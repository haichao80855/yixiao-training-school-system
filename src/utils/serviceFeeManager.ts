import type { ServiceFeeRecord } from '@/types/student';

export const PRESET_SERVICE_FEES: ServiceFeeRecord[] = [
  {
    id: 'sf-001',
    certNo: 'BK20260901-01',
    studentId: 'std-001',
    studentName: '张小萌',
    studentNo: 'S948918',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    examType: '中国电子学会 Scratch 软件编程一级考级',
    category: 'certification',
    fee: 360,
    invoiceTitle: '张建国 (个人)',
    yikuaibaoVoucherNo: 'YKB-20260901-0089',
    status: 'verified',
    createTime: '2026-09-01 10:20',
    verifyTime: '2026-09-02 14:15',
    operator: '张学管',
    voucherImage: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400'
  },
  {
    id: 'sf-002',
    certNo: 'BK20260905-02',
    studentId: 'std-002',
    studentName: '李浩轩',
    studentNo: 'S765585',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    examType: '全国青少年信息学奥林匹克联赛 CSP-J 初赛',
    category: 'competition',
    fee: 500,
    invoiceTitle: '北京明德科技发展有限公司',
    yikuaibaoVoucherNo: '',
    status: 'pending',
    createTime: '2026-09-05 14:10',
    operator: '李销售'
  },
  {
    id: 'sf-003',
    certNo: 'BK20260910-03',
    studentId: 'std-009',
    studentName: '何天宇',
    studentNo: 'S948206',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    examType: '第15届蓝桥杯青少组国赛代报名考务费',
    category: 'competition',
    fee: 680,
    invoiceTitle: '何伟 (个人)',
    yikuaibaoVoucherNo: 'YKB-20260911-0112',
    status: 'verified',
    createTime: '2026-09-10 09:30',
    verifyTime: '2026-09-11 11:20',
    operator: '何学管'
  },
  {
    id: 'sf-004',
    certNo: 'BK20260915-04',
    studentId: 'std-008',
    studentName: '孙嘉怡',
    studentNo: 'S821105',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    examType: '中国工信部少儿编程二级认证考务费',
    category: 'certification',
    fee: 420,
    invoiceTitle: '孙磊 (个人)',
    yikuaibaoVoucherNo: '',
    status: 'pending',
    createTime: '2026-09-15 16:45',
    operator: '孙学管'
  }
];

class ServiceFeeStore {
  private records: ServiceFeeRecord[] = JSON.parse(JSON.stringify(PRESET_SERVICE_FEES));

  getRecords(campusId?: string): ServiceFeeRecord[] {
    if (!campusId || campusId === 'all') {
      return [...this.records];
    }
    return this.records.filter(r => r.campusId === campusId);
  }

  addRecord(data: Omit<ServiceFeeRecord, 'id' | 'certNo' | 'createTime' | 'status' | 'yikuaibaoVoucherNo'>): ServiceFeeRecord {
    const newRecord: ServiceFeeRecord = {
      ...data,
      id: `sf-${Date.now()}`,
      certNo: `BK${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`,
      createTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'pending',
      yikuaibaoVoucherNo: ''
    };
    this.records.unshift(newRecord);
    return newRecord;
  }

  verifyRecord(id: string, voucherNo: string): boolean {
    const r = this.records.find(item => item.id === id);
    if (r) {
      r.status = 'verified';
      r.yikuaibaoVoucherNo = voucherNo;
      r.verifyTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
      return true;
    }
    return false;
  }

  batchVerifyRecords(ids: string[]): number {
    let count = 0;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    for (const id of ids) {
      const r = this.records.find(item => item.id === id);
      if (r && r.status === 'pending') {
        r.status = 'verified';
        r.yikuaibaoVoucherNo = `YKB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        r.verifyTime = nowStr;
        count++;
      }
    }
    return count;
  }
}

export const serviceFeeManager = new ServiceFeeStore();
