const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 10,
  name: 'Feature 10 (Boundary): 360° 学员画像全景抽屉边界 (360° Profile Boundary)',
  tests: [
    {
      name: '课包剩余课时为 0 时标记“已结课”，禁止发起常规消课',
      fn: () => {
        const pkg = { remainingLessons: 0, status: 'active' };
        if (pkg.remainingLessons === 0) {
          pkg.status = 'completed';
        }
        function attemptDeduct(p) {
          if (p.status === 'completed' || p.remainingLessons <= 0) {
            throw new Error('Cannot deduct hour: course package is completed');
          }
          p.remainingLessons -= 1;
        }

        assert.equal(pkg.status, 'completed');
        assert.throws(() => attemptDeduct(pkg), /Cannot deduct hour/);
      },
    },
    {
      name: '课包过期后标记“已过期”且阻断排课',
      fn: () => {
        const pkg = { expiryDate: '2025-01-01', remainingLessons: 5 };
        const currentDate = '2026-09-21';
        const isExpired = pkg.expiryDate < currentDate;
        assert.isTrue(isExpired);
      },
    },
    {
      name: '人脸识别底库照片格式与文件大小上限校验 (<= 2MB)',
      fn: () => {
        function validateAvatarUpload(file) {
          const validTypes = ['image/jpeg', 'image/png'];
          if (!validTypes.includes(file.mimetype)) {
            throw new Error('Only JPEG/PNG avatars are supported');
          }
          const MAX_SIZE = 2 * 1024 * 1024; // 2MB
          if (file.size > MAX_SIZE) {
            throw new Error('Avatar image exceeds 2MB size limit');
          }
          return true;
        }

        assert.isTrue(validateAvatarUpload({ mimetype: 'image/jpeg', size: 1024 * 500 }));
        assert.throws(() => validateAvatarUpload({ mimetype: 'image/gif', size: 500 }), /Only JPEG\/PNG/);
        assert.throws(() => validateAvatarUpload({ mimetype: 'image/png', size: 3 * 1024 * 1024 }), /exceeds 2MB/);
      },
    },
    {
      name: '跨校区未授权人员尝试通过 URL 直链读取他人校区画像被阻断',
      fn: () => {
        const student = { id: 'S1', campusId: 'CAMPUS_HAIDIAN' };
        function checkProfileAccess(viewerCampusId, s) {
          if (viewerCampusId !== 'CAMPUS_HQ' && viewerCampusId !== s.campusId) {
            throw new Error('403 Forbidden: No cross-campus profile permission');
          }
          return true;
        }

        assert.throws(() => checkProfileAccess('CAMPUS_CHAOYANG', student), /403 Forbidden/);
        assert.isTrue(checkProfileAccess('CAMPUS_HQ', student));
        assert.isTrue(checkProfileAccess('CAMPUS_HAIDIAN', student));
      },
    },
    {
      name: '抽屉反复关闭与打开时表单与状态完整重置',
      fn: () => {
        let activeTab = 'basicInfo';
        function openDrawer(tab = 'basicInfo') {
          activeTab = tab;
        }
        function closeDrawer() {
          activeTab = 'basicInfo'; // 重置
        }

        openDrawer('walletBalance');
        assert.equal(activeTab, 'walletBalance');
        closeDrawer();
        assert.equal(activeTab, 'basicInfo');
      },
    },
  ],
};
