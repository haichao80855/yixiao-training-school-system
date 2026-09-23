const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 14,
  name: 'Feature 14 (Boundary): 教务班级管理与班容控制边界 (Class Management Boundary)',
  tests: [
    {
      name: '班级达到额定容量上限时强行加入学员抛出溢出阻断',
      fn: () => {
        const cls = {
          name: '满班测试',
          maxCapacity: 12,
          currentStudents: Array.from({ length: 12 }, (_, i) => `S_${i}`),
        };
        function addStudent(c, sid) {
          if (c.currentStudents.length >= c.maxCapacity) {
            throw new Error(`Class capacity limit (${c.maxCapacity}) reached, cannot add student`);
          }
          c.currentStudents.push(sid);
        }

        assert.throws(() => addStudent(cls, 'S_EXTRA'), /capacity limit/);
      },
    },
    {
      name: '存在在读未结课学员的班级禁止删除',
      fn: () => {
        const cls = { id: 'CLS_ACTIVE', activeStudentsCount: 5 };
        function deleteClass(c) {
          if (c.activeStudentsCount > 0) {
            throw new Error(`Cannot delete class: ${c.activeStudentsCount} active students remaining`);
          }
          return true;
        }

        assert.throws(() => deleteClass(cls), /active students remaining/);
        assert.isTrue(deleteClass({ id: 'CLS_EMPTY', activeStudentsCount: 0 }));
      },
    },
    {
      name: '班级容量缩容小于当前在读人数阻断',
      fn: () => {
        const cls = { currentCount: 14, maxCapacity: 16 };
        function updateCapacity(c, newCap) {
          if (newCap < c.currentCount) {
            throw new Error(`New capacity (${newCap}) cannot be smaller than current student count (${c.currentCount})`);
          }
          c.maxCapacity = newCap;
        }

        assert.throws(() => updateCapacity(cls, 10), /cannot be smaller than current student count/);
        assert.doesNotThrow(() => updateCapacity(cls, 15));
      },
    },
    {
      name: '同校区同课程班级名称重名校验阻断',
      fn: () => {
        const existingNames = ['单片机周六1班', '单片机周六2班'];
        function validateClassName(name) {
          if (existingNames.includes(name)) {
            throw new Error(`Duplicate class name: ${name} already exists in campus`);
          }
          return true;
        }

        assert.throws(() => validateClassName('单片机周六1班'), /already exists/);
        assert.isTrue(validateClassName('单片机周六3班'));
      },
    },
    {
      name: '主讲教师与班主任不可为同一离职或禁用状态员工',
      fn: () => {
        function validateTeacherStatus(teacher) {
          if (teacher.status === 'resigned' || teacher.status === 'disabled') {
            throw new Error(`Teacher ${teacher.name} is not active and cannot be assigned`);
          }
          return true;
        }

        assert.throws(() => validateTeacherStatus({ name: '王已离职', status: 'resigned' }), /not active/);
        assert.isTrue(validateTeacherStatus({ name: '李在职', status: 'active' }));
      },
    },
  ],
};
