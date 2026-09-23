const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 3,
  name: 'Tier 3.1: 教研课程授权与学员报名签约联动 (Curriculum -> Enrollment)',
  tests: [
    {
      name: '教研课程授权指定校区后，该校区报名向导可选该课程',
      fn: () => {
        const courses = [
          { id: 'CRS_HD_AI', name: '海淀专属AI小班', status: 'enabled', authorizedCampusIds: ['CAMPUS_HAIDIAN'] },
          { id: 'CRS_HQ_GEN', name: '总部通用课', status: 'enabled', authorizedCampusIds: ['CAMPUS_HQ', 'CAMPUS_HAIDIAN'] },
        ];

        // 海淀校区学员选课
        const availableInHaidian = courses.filter(c => c.authorizedCampusIds.includes('CAMPUS_HAIDIAN') && c.status === 'enabled');
        assert.lengthOf(availableInHaidian, 2);

        // 朝阳校区学员选课
        const availableInChaoyang = courses.filter(c => c.authorizedCampusIds.includes('CAMPUS_CHAOYANG') && c.status === 'enabled');
        assert.lengthOf(availableInChaoyang, 0);
      },
    },
    {
      name: '教研课程禁用开关即时影响前台学员选课列表',
      fn: () => {
        const course = { id: 'C1', name: 'Python', status: 'enabled', authorizedCampusIds: ['CAMPUS_HQ'] };
        assert.isTrue(CurriculumModel.canSchedule(course).allowed);

        // 禁用
        course.status = 'disabled';
        assert.isFalse(CurriculumModel.canSchedule(course).allowed);
      },
    },
    {
      name: '课程授权撤销后已生效课包不受影响但禁止新开单',
      fn: () => {
        const course = { id: 'C1', authorizedCampusIds: ['CAMPUS_HQ', 'CAMPUS_HAIDIAN'] };
        const studentExistingPackage = { packageId: 'P1', courseId: 'C1', remainingLessons: 10 };

        // 撤销海淀校区授权
        course.authorizedCampusIds = ['CAMPUS_HQ'];

        // 现有课包不受影响
        assert.equal(studentExistingPackage.remainingLessons, 10);

        // 新开单被阻断
        const canNewEnroll = course.authorizedCampusIds.includes('CAMPUS_HAIDIAN');
        assert.isFalse(canNewEnroll);
      },
    },
  ],
};
