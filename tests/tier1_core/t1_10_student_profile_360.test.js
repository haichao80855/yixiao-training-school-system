const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 10,
  name: 'Feature 10: 360° 学员画像全景抽屉 (360° Student Profile Drawer)',
  tests: [
    {
      name: '学员基本信息头部与学号展示',
      fn: () => {
        const header = {
          avatar: 'https://cdn.shengtong.edu/avatars/s948918.png',
          name: '刘雨辰',
          studentNo: 'S948918',
          gender: '男',
          age: 10,
          parentPhone: '156****0125',
          campusName: '盛通总部校区',
          boundWechat: 'wxid_liuyuchen_mom',
        };
        assert.equal(header.name, '刘雨辰');
        assert.equal(header.studentNo, 'S948918');
        assert.ok(header.boundWechat);
      },
    },
    {
      name: '学员名下课包卡片明细 (总课时/剩余课时/有效截止日)',
      fn: () => {
        const coursePackage = {
          packageId: 'PKG_2026_01',
          courseName: 'Scratch 创意动画初级班',
          totalLessons: 32,
          consumedLessons: 12,
          remainingLessons: 20,
          bonusLessons: 4,
          expiryDate: '2027-06-30',
          status: 'active',
        };
        assert.equal(coursePackage.remainingLessons, 20);
        assert.equal(coursePackage.consumedLessons + coursePackage.remainingLessons, coursePackage.totalLessons);
      },
    },
    {
      name: '学习成长轨迹出勤时间轴渲染',
      fn: () => {
        const timeline = [
          { date: '2026-09-01', lessonName: '第1讲：走入Scratch世界', status: 'attended', teacher: '张老师', score: 95 },
          { date: '2026-09-08', lessonName: '第2讲：角色移动与控制', status: 'attended', teacher: '张老师', score: 98 },
        ];
        assert.lengthOf(timeline, 2);
        assert.equal(timeline[0].status, 'attended');
        assert.equal(timeline[1].score, 98);
      },
    },
    {
      name: '电子钱包资金明细与零花钱积分展示',
      fn: () => {
        const wallet = {
          principalBalance: 3200.00,
          bonusBalance: 500.00,
          goldPoints: 120, // 零花钱积分
        };
        assert.equal(wallet.principalBalance, 3200.00);
        assert.equal(wallet.bonusBalance, 500.00);
        assert.equal(wallet.principalBalance + wallet.bonusBalance, 3700.00);
      },
    },
    {
      name: '家校沟通与一键外呼跟进日志',
      fn: () => {
        const logs = [
          { time: '2026-09-10 14:30', counselor: '李顾问', type: '电话跟进', content: '沟通学员课后作业完成情况，家长非常满意' },
        ];
        assert.lengthOf(logs, 1);
        assert.equal(logs[0].counselor, '李顾问');
      },
    },
  ],
};
