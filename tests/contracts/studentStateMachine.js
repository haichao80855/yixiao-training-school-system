/**
 * 学员中心与 7 分支异常状态机契约模型 (Student State Machine & Wallet)
 * 对应 PROJECT.md § Interface Contracts 3, 4 & Features 9, 10, 11, 12, 13
 */

class StudentStateMachine {
  constructor(student) {
    this.student = JSON.parse(JSON.stringify(student));
  }

  getStudent() {
    return this.student;
  }

  // 1. 转班 (Transfer Class)
  transferClass(coursePackageId, fromClassId, toClassId, targetClassCapacity, targetClassCurrentCount) {
    if (this.student.status === 'suspended') {
      throw new Error('Cannot transfer class while student is suspended');
    }
    if (targetClassCurrentCount >= targetClassCapacity) {
      throw new Error('Target class capacity exceeded');
    }
    const pkg = this.student.coursePackages.find(p => p.packageId === coursePackageId);
    if (!pkg || pkg.status !== 'active') {
      throw new Error('Course package is not active');
    }
    pkg.classId = toClassId;
    return { success: true, fromClassId, toClassId, packageId: coursePackageId };
  }

  // 2. 换课 (Change Course)
  changeCourse(oldPackageId, newCourse, newPurchasedLessons) {
    const oldPkg = this.student.coursePackages.find(p => p.packageId === oldPackageId);
    if (!oldPkg || oldPkg.status !== 'active') {
      throw new Error('Original course package is not active');
    }
    if (newPurchasedLessons <= 0) {
      throw new Error('New purchased lessons must be greater than 0');
    }

    const oldResidualValue = Number((oldPkg.remainingLessons * oldPkg.pricePerLesson).toFixed(2));
    const newTotalCost = Number((newPurchasedLessons * newCourse.pricePerLesson).toFixed(2));
    const diff = Number((oldResidualValue - newTotalCost).toFixed(2));

    oldPkg.status = 'completed'; // Decommission old package

    let walletCredited = 0;
    let pendingPaymentRequired = 0;

    if (diff > 0) {
      // 剩余价值高于新课总价，差额退回电子钱包本金
      this.student.wallet.principalBalance = Number((this.student.wallet.principalBalance + diff).toFixed(2));
      walletCredited = diff;
    } else if (diff < 0) {
      // 产生正向差额，需要补交差额订单
      pendingPaymentRequired = Math.abs(diff);
    }

    const newPkg = {
      packageId: `PKG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId: newCourse.id,
      courseName: newCourse.name,
      pricePerLesson: newCourse.pricePerLesson,
      remainingLessons: newPurchasedLessons,
      totalLessons: newPurchasedLessons,
      bonusLessons: 0,
      status: 'active',
    };
    this.student.coursePackages.push(newPkg);

    return {
      success: true,
      oldResidualValue,
      newTotalCost,
      diff,
      walletCredited,
      pendingPaymentRequired,
      newPackage: newPkg,
    };
  }

  // 3. 停课/休学 (Suspend)
  suspend(suspensionDays = 30) {
    if (this.student.status === 'suspended') {
      throw new Error('Student is already suspended');
    }
    if (this.student.status === 'dropped_out') {
      throw new Error('Cannot suspend dropped out student');
    }
    this.student.status = 'suspended';
    for (const pkg of this.student.coursePackages) {
      if (pkg.status === 'active') {
        pkg.status = 'frozen';
        if (pkg.expiryDate) {
          const exp = new Date(pkg.expiryDate);
          exp.setDate(exp.getDate() + suspensionDays);
          pkg.expiryDate = exp.toISOString().split('T')[0];
        }
      }
    }
    return { success: true, status: 'suspended', suspensionDays };
  }

  // 4. 复课 (Resume)
  resume() {
    if (this.student.status !== 'suspended') {
      throw new Error('Student is not suspended');
    }
    this.student.status = 'normal';
    for (const pkg of this.student.coursePackages) {
      if (pkg.status === 'frozen') {
        pkg.status = 'active';
      }
    }
    return { success: true, status: 'normal' };
  }

  // 5. 转校 (Transfer Campus)
  transferCampus(targetCampusId, authorizedCampusIds) {
    if (!authorizedCampusIds.includes(targetCampusId)) {
      throw new Error(`Unauthorized cross-campus transfer to ${targetCampusId}`);
    }
    if (this.student.campusId === targetCampusId) {
      throw new Error('Target campus cannot be identical to current campus');
    }
    const sourceCampusId = this.student.campusId;
    this.student.campusId = targetCampusId;
    this.student.status = 'normal';
    return { success: true, sourceCampusId, targetCampusId };
  }

  // 6. 转让 (Transfer Student)
  transferStudent(targetStudentProfile) {
    if (!targetStudentProfile || !targetStudentProfile.id) {
      throw new Error('Target student is invalid');
    }
    const transferredPackages = [];
    for (const pkg of this.student.coursePackages) {
      if (pkg.status === 'active' && pkg.remainingLessons > 0) {
        transferredPackages.push({ ...pkg, packageId: `PKG_TRANS_${pkg.packageId}` });
        pkg.status = 'completed';
        pkg.remainingLessons = 0;
      }
    }
    const transferredWallet = { ...this.student.wallet };
    this.student.wallet.principalBalance = 0;
    this.student.wallet.bonusBalance = 0;

    targetStudentProfile.coursePackages = targetStudentProfile.coursePackages || [];
    targetStudentProfile.coursePackages.push(...transferredPackages);
    targetStudentProfile.wallet = targetStudentProfile.wallet || { principalBalance: 0, bonusBalance: 0 };
    targetStudentProfile.wallet.principalBalance += transferredWallet.principalBalance;
    targetStudentProfile.wallet.bonusBalance += transferredWallet.bonusBalance;

    return {
      success: true,
      transferredPackagesCount: transferredPackages.length,
      transferredWallet,
    };
  }

  // 7. 退费 (Refund)
  refund(coursePackageId, deductionFee = 0) {
    const pkg = this.student.coursePackages.find(p => p.packageId === coursePackageId);
    if (!pkg) {
      throw new Error('Course package not found');
    }
    if (pkg.status === 'refunded' || pkg.status === 'completed') {
      throw new Error('Course package has already reached terminal status');
    }

    const purchasedRegularLessons = pkg.totalLessons - (pkg.bonusLessons || 0);
    const consumedLessons = pkg.totalLessons - pkg.remainingLessons;

    // 基础有效退款金额：只退购买课时的剩余价值
    let refundableAmount = Math.max(0, pkg.remainingLessons - (pkg.bonusLessons || 0)) * pkg.pricePerLesson;

    // 若消耗课时已经占用了赠送课时（即已上课时超过正课），按正课单价补扣
    if (consumedLessons > purchasedRegularLessons) {
      const excessBonusConsumed = consumedLessons - purchasedRegularLessons;
      const clawback = excessBonusConsumed * pkg.pricePerLesson;
      refundableAmount = Math.max(0, refundableAmount - clawback);
    }

    refundableAmount = Math.max(0, refundableAmount - deductionFee);
    refundableAmount = Number(refundableAmount.toFixed(2));

    pkg.status = 'refunded';
    pkg.remainingLessons = 0;
    pkg.bonusLessons = 0;

    return {
      success: true,
      refundAmount: refundableAmount,
      deductionFee,
      packageStatus: 'refunded',
    };
  }

  // 电子钱包扣款
  walletDeduct(amount) {
    if (amount <= 0) throw new Error('Deduction amount must be positive');
    const total = Number((this.student.wallet.principalBalance + this.student.wallet.bonusBalance).toFixed(2));
    if (amount > total) {
      throw new Error('Insufficient wallet balance');
    }
    let remainingToDeduct = amount;
    // 优先扣除赠送金还是本金：盛通规则优先扣赠送金
    if (this.student.wallet.bonusBalance >= remainingToDeduct) {
      this.student.wallet.bonusBalance = Number((this.student.wallet.bonusBalance - remainingToDeduct).toFixed(2));
      remainingToDeduct = 0;
    } else {
      remainingToDeduct = Number((remainingToDeduct - this.student.wallet.bonusBalance).toFixed(2));
      this.student.wallet.bonusBalance = 0;
      this.student.wallet.principalBalance = Number((this.student.wallet.principalBalance - remainingToDeduct).toFixed(2));
    }
    return { success: true, balance: this.student.wallet };
  }

  // 钱包提现（只允许本金提现）
  walletWithdraw(amount) {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (amount > this.student.wallet.principalBalance) {
      throw new Error('Cannot withdraw more than principal balance (bonus balance cannot be withdrawn)');
    }
    this.student.wallet.principalBalance = Number((this.student.wallet.principalBalance - amount).toFixed(2));
    return { success: true, withdrawn: amount, remainingPrincipal: this.student.wallet.principalBalance };
  }
}

module.exports = StudentStateMachine;
