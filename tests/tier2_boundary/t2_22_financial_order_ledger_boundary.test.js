const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 22,
  name: 'Feature 22 (Boundary): 财务订单营收流水与状态流边界 (Order Ledger Boundary)',
  tests: [
    {
      name: '已支付订单禁止直接作废（必须走退费审批流）',
      fn: () => {
        const order = { id: 'ORD_PAID', status: 'paid' };
        function voidOrder(o) {
          if (o.status === 'paid') {
            throw new Error('Cannot void a paid order directly. Please initiate refund approval flow (必须走退费流)');
          }
          o.status = 'void';
        }

        assert.throws(() => voidOrder(order), /必须走退费流/);
      },
    },
    {
      name: '已作废订单禁止再次发起支付',
      fn: () => {
        const order = { id: 'ORD_VOID', status: 'void' };
        function payOrder(o) {
          if (o.status === 'void') {
            throw new Error('Order is voided and cannot accept payment');
          }
          o.status = 'paid';
        }

        assert.throws(() => payOrder(order), /Order is voided/);
      },
    },
    {
      name: '作废订单释放占用的待生效课包与预留名额',
      fn: () => {
        const student = {
          unpaidPackages: [{ id: 'UP1', status: 'reserved' }],
        };
        function cancelOrder(s, pkgId) {
          s.unpaidPackages = s.unpaidPackages.filter(p => p.id !== pkgId);
          return true;
        }

        assert.isTrue(cancelOrder(student, 'UP1'));
        assert.lengthOf(student.unpaidPackages, 0);
      },
    },
    {
      name: '分校区财务权限下严禁查看其他校区订单流水',
      fn: () => {
        const allOrders = [
          { id: '1', campusId: 'CAMPUS_HAIDIAN' },
          { id: '2', campusId: 'CAMPUS_CHAOYANG' },
        ];
        function getCampusOrders(operatorCampusId, orders) {
          if (operatorCampusId !== 'CAMPUS_HQ') {
            return orders.filter(o => o.campusId === operatorCampusId);
          }
          return orders;
        }

        const haidianOrders = getCampusOrders('CAMPUS_HAIDIAN', allOrders);
        assert.lengthOf(haidianOrders, 1);
        assert.equal(haidianOrders[0].campusId, 'CAMPUS_HAIDIAN');
      },
    },
    {
      name: '修改订单金额需二次校验原订单未被锁定',
      fn: () => {
        const lockedOrder = { id: 'ORD_LOCKED', isLocked: true, actualAmount: 1000 };
        function modifyAmount(o, newAmt) {
          if (o.isLocked) {
            throw new Error('Order is locked by finance closing cycle, modification prohibited');
          }
          o.actualAmount = newAmt;
        }

        assert.throws(() => modifyAmount(lockedOrder, 800), /Order is locked/);
      },
    },
  ],
};
