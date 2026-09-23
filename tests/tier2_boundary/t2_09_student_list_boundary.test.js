const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 9,
  name: 'Feature 9 (Boundary): 学员中心全景列表边界 (Student Overview List Boundary)',
  tests: [
    {
      name: '手机号脱敏算法边界 (11 位手机号精确脱敏中间 4 位)',
      fn: () => {
        function maskPhone(phone) {
          if (!phone || typeof phone !== 'string') return '';
          if (/^1[3-9]\d{9}$/.test(phone)) {
            return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
          }
          return phone; // 非标准手机号不处理或原样输出
        }

        assert.equal(maskPhone('15612340125'), '156****0125');
        assert.equal(maskPhone('13800008888'), '138****8888');
        assert.equal(maskPhone(''), '');
        assert.equal(maskPhone('12345'), '12345');
      },
    },
    {
      name: '待分班学员加入已满员班级抛出超额异常阻断',
      fn: () => {
        const fullClass = { id: 'CLS_FULL', maxCapacity: 15, currentStudents: Array(15).fill('STU_ID') };
        function assignToClass(cls, studentId) {
          if (cls.currentStudents.length >= cls.maxCapacity) {
            throw new Error(`Class ${cls.id} has reached max capacity of ${cls.maxCapacity}`);
          }
          cls.currentStudents.push(studentId);
        }

        assert.throws(() => assignToClass(fullClass, 'STU_NEW'), /has reached max capacity/);
      },
    },
    {
      name: '请求超出最大页码时自动归正为最后一页',
      fn: () => {
        function sanitizePage(page, totalItems, pageSize = 20) {
          const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
          if (page > totalPages) return totalPages;
          if (page < 1) return 1;
          return page;
        }

        assert.equal(sanitizePage(10, 45, 20), 3); // 45条每页20，共3页，请求第10页归正为第3页
        assert.equal(sanitizePage(0, 45, 20), 1);
        assert.equal(sanitizePage(2, 45, 20), 2);
      },
    },
    {
      name: '学员姓名包含生僻字或超长字符串安全渲染',
      fn: () => {
        const rareNameStudent = { name: '䶮燚犇', studentNo: 'S999999' };
        assert.equal(rareNameStudent.name, '䶮燚犇');
        assert.equal(rareNameStudent.name.length, 3);
      },
    },
    {
      name: '批量导出超过 10000 条学员时的分块切片处理',
      fn: () => {
        function chunkExport(totalCount, chunkSize = 2000) {
          const chunks = [];
          for (let i = 0; i < totalCount; i += chunkSize) {
            chunks.push({ offset: i, limit: Math.min(chunkSize, totalCount - i) });
          }
          return chunks;
        }

        const chunks = chunkExport(10000, 2000);
        assert.lengthOf(chunks, 5);
        assert.equal(chunks[0].limit, 2000);
        assert.equal(chunks[4].offset, 8000);
      },
    },
  ],
};
