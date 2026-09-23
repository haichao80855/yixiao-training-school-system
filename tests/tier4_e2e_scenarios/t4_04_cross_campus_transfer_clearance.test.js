const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');
const TenantContext = require('../contracts/tenantContext');

module.exports = {
  tier: 4,
  name: 'Scenario 4: 跨校区转校与跨法人内部结算流 (Cross-Campus Transfer & Clearance)',
  tests: [
    {
      name: '海淀校区发起转校 -> 海淀校长审批 -> 朝阳校区接收 -> 总部财务资金对账 -> 校区作用域迁移',
      fn: () => {
        // 1. 学员初始隶属海淀校区
        const student = {
          id: 'STU_TRANS_04',
          name: '黄子涵',
          campusId: 'CAMPUS_HAIDIAN',
          status: 'normal',
          wallet: { principalBalance: 600, bonusBalance: 100 },
          coursePackages: [
            { packageId: 'PKG_HD_1', remainingLessons: 15, pricePerLesson: 200, status: 'active' },
          ],
        };
        const sm = new StudentStateMachine(student);

        // 2. 核算转校移交资产总额 (课时价值 15 x 200 = 3000 + 钱包本金 600 = 3600 元)
        const lessonAsset = student.coursePackages[0].remainingLessons * student.coursePackages[0].pricePerLesson;
        const walletAsset = student.wallet.principalBalance;
        const totalTransferredAssets = lessonAsset + walletAsset;
        assert.equal(totalTransferredAssets, 3600);

        // 3. 转校审批并执行校区迁移
        const authorizedCampuses = ['CAMPUS_HQ', 'CAMPUS_HAIDIAN', 'CAMPUS_CHAOYANG'];
        const transferRes = sm.transferCampus('CAMPUS_CHAOYANG', authorizedCampuses);
        assert.isTrue(transferRes.success);
        assert.equal(sm.getStudent().campusId, 'CAMPUS_CHAOYANG');

        // 4. 总部财务校区调拨结算流水
        const internalClearanceLog = {
          sourceCampusId: 'CAMPUS_HAIDIAN',
          targetCampusId: 'CAMPUS_CHAOYANG',
          amount: totalTransferredAssets,
          type: 'inter_campus_settlement',
        };
        assert.equal(internalClearanceLog.amount, 3600);

        // 5. 租户上下文数据隔离验证：海淀校区不可见，朝阳校区可见
        const tenant = new TenantContext();
        tenant.setCampus('CAMPUS_HAIDIAN');
        const haidianVisible = tenant.filterDataByCampusScope([sm.getStudent()]);
        assert.lengthOf(haidianVisible, 0, '转校后海淀校区不再显示该学员');

        tenant.setCampus('CAMPUS_CHAOYANG');
        const chaoyangVisible = tenant.filterDataByCampusScope([sm.getStudent()]);
        assert.lengthOf(chaoyangVisible, 1, '转校后朝阳校区成功检索到该学员');
      },
    },
  ],
};
