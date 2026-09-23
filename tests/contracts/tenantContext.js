/**
 * 租户与多校区上下文契约模型 (Tenant & Campus Context Contract)
 * 对应 PROJECT.md § Interface Contracts 1 & Feature 3, 26
 */

class TenantContext {
  constructor(initialState = {}) {
    this.companyId = initialState.companyId || 'ORG_SHENGTONG_001';
    this.campuses = initialState.campuses || [
      { id: 'CAMPUS_HQ', code: 'HQ001', name: '盛通总部校区', isHeadquarter: true },
      { id: 'CAMPUS_HAIDIAN', code: 'HD002', name: '海淀世纪金源校区', isHeadquarter: false },
      { id: 'CAMPUS_CHAOYANG', code: 'CY003', name: '朝阳大悦城校区', isHeadquarter: false },
      { id: 'CAMPUS_XICHENG', code: 'XC004', name: '西城金融街校区', isHeadquarter: false },
    ];
    this.currentCampusId = initialState.currentCampusId || 'CAMPUS_HQ';
    this.listeners = [];
  }

  getCurrentCampus() {
    return this.campuses.find(c => c.id === this.currentCampusId) || this.campuses[0];
  }

  setCampus(campusId) {
    if (!campusId) {
      throw new Error('Campus ID cannot be empty');
    }
    const found = this.campuses.find(c => c.id === campusId);
    if (!found) {
      throw new Error(`Unauthorized or invalid campus ID: ${campusId}`);
    }
    const prevCampusId = this.currentCampusId;
    this.currentCampusId = campusId;
    this.notifyListeners({ prevCampusId, currentCampusId: campusId, campus: found });
    return found;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  filterDataByCampusScope(dataSet, scopeField = 'campusId') {
    const current = this.getCurrentCampus();
    // If user is viewing HQ and has global visibility, or filter specifically by campus
    return dataSet.filter(item => {
      if (item.isGlobal) return true;
      if (Array.isArray(item.authorizedCampusIds)) {
        return item.authorizedCampusIds.includes(this.currentCampusId);
      }
      return item[scopeField] === this.currentCampusId;
    });
  }
}

module.exports = TenantContext;
