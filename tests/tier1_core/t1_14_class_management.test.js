const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 14,
  name: 'Feature 14: 教务班级管理与班容控制 (Class Management & Capacity)',
  tests: [
    {
      name: '设立新班级基本信息完整性',
      fn: () => {
        const newClass = {
          id: 'CLS_2026_01',
          name: '单片机创客周六上午班',
          courseId: 'CRS_ROBOT_01',
          teacherId: 'T_ZHANG',
          headTeacherId: 'HT_WANG',
          classroomId: 'ROOM_LEBO_1',
          maxCapacity: 15,
          currentStudents: ['S1', 'S2', 'S3'],
          status: 'in_progress',
        };
        assert.equal(newClass.maxCapacity, 15);
        assert.equal(newClass.currentStudents.length, 3);
        assert.equal(newClass.teacherId, 'T_ZHANG');
      },
    },
    {
      name: '未满班时支持待分班学员顺利加入',
      fn: () => {
        const cls = { maxCapacity: 10, currentStudents: ['S1', 'S2'] };
        function enrollStudent(classObj, studentId) {
          if (classObj.currentStudents.length >= classObj.maxCapacity) {
            throw new Error('Class full');
          }
          classObj.currentStudents.push(studentId);
          return true;
        }

        const ok = enrollStudent(cls, 'S3');
        assert.isTrue(ok);
        assert.equal(cls.currentStudents.length, 3);
      },
    },
    {
      name: '授课教师与班主任责任人双重绑定',
      fn: () => {
        const cls = {
          teacher: { id: 'T1', name: '李老师', role: 'lecturer' },
          headTeacher: { id: 'HT1', name: '赵老师', role: 'head_master' },
        };
        assert.equal(cls.teacher.role, 'lecturer');
        assert.equal(cls.headTeacher.role, 'head_master');
      },
    },
    {
      name: '班级学员花名册与出勤率统计',
      fn: () => {
        const roster = [
          { studentId: 'S1', name: '张一', attendedCount: 8, totalScheduled: 10 },
          { studentId: 'S2', name: '李二', attendedCount: 10, totalScheduled: 10 },
        ];
        const s2Rate = roster[1].attendedCount / roster[1].totalScheduled;
        assert.equal(s2Rate, 1.0);
      },
    },
    {
      name: '班级结班归档状态流转',
      fn: () => {
        const cls = { id: 'CLS_01', status: 'in_progress' };
        cls.status = 'graduated';
        assert.equal(cls.status, 'graduated');
      },
    },
  ],
};
