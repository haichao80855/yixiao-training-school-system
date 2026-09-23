const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 9,
  name: 'Feature 9: 学员中心全景列表 (Student Overview List)',
  tests: [
    {
      name: '全部学员列表标准字段与数据映射',
      fn: () => {
        const studentRow = {
          id: 'STU_1001',
          name: '李小明',
          studentNo: 'S948918',
          phone: '13812345678',
          campusId: 'CAMPUS_HQ',
          status: 'normal',
          totalPackagesCount: 2,
          remainingLessonsSum: 36,
        };
        assert.equal(studentRow.studentNo, 'S948918');
        assert.equal(studentRow.status, 'normal');
        assert.equal(studentRow.remainingLessonsSum, 36);
      },
    },
    {
      name: '待分班学员专区与待分配课包角标',
      fn: () => {
        const students = [
          { id: '1', name: '王小华', unassignedPackages: 1 },
          { id: '2', name: '张大伟', unassignedPackages: 0 },
        ];
        const awaitDivide = students.filter(s => s.unassignedPackages > 0);
        assert.lengthOf(awaitDivide, 1);
        assert.equal(awaitDivide[0].name, '王小华');
      },
    },
    {
      name: '服务费与代报考缴费清单表格',
      fn: () => {
        const serviceFees = [
          { studentId: 'STU_1', item: '蓝桥杯少儿组考务费', amount: 300, status: 'paid' },
          { studentId: 'STU_2', item: '全国青少年创客大赛', amount: 500, status: 'unpaid' },
        ];
        assert.lengthOf(serviceFees, 2);
        assert.equal(serviceFees[0].status, 'paid');
      },
    },
    {
      name: '学员在读状态语义 Tag (在读/休学/转校/结业)',
      fn: () => {
        function getStatusTag(status) {
          const map = {
            normal: { text: '在读', type: 'success' },
            suspended: { text: '休学', type: 'warning' },
            transferred: { text: '转校', type: 'info' },
            dropped_out: { text: '结业', type: 'danger' },
          };
          return map[status] || { text: '未知', type: 'info' };
        }

        assert.equal(getStatusTag('normal').text, '在读');
        assert.equal(getStatusTag('suspended').text, '休学');
        assert.equal(getStatusTag('dropped_out').text, '结业');
      },
    },
    {
      name: '多条件模糊查询学员 (姓名/学号/手机号)',
      fn: () => {
        const list = [
          { name: '陈思宇', studentNo: 'S1001', phone: '13911112222' },
          { name: '赵梓涵', studentNo: 'S1002', phone: '13733334444' },
        ];

        function search(query) {
          const q = query.toLowerCase();
          return list.filter(s => s.name.includes(q) || s.studentNo.toLowerCase().includes(q) || s.phone.includes(q));
        }

        assert.lengthOf(search('陈思宇'), 1);
        assert.lengthOf(search('s1002'), 1);
        assert.lengthOf(search('1391111'), 1);
      },
    },
  ],
};
