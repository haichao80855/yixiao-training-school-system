/**
 * 教研课程契约模型与规范 (Curriculum Contract)
 * 对应 PROJECT.md § Interface Contracts 2 & Features 5, 6, 7, 8
 */

class CurriculumModel {
  static validateCourseItem(course) {
    const errors = [];
    if (!course.name || course.name.trim().length === 0) {
      errors.push('Course name is required');
    }
    if (typeof course.pricePerLesson !== 'number' || course.pricePerLesson < 0) {
      errors.push('Price per lesson must be a non-negative number');
    }
    if (typeof course.totalLessons !== 'number' || course.totalLessons <= 0) {
      errors.push('Total lessons must be greater than 0');
    }
    const validAttributes = ['regular', 'extended', 'activity', 'trial', 'training', 'service_fee'];
    if (!validAttributes.includes(course.attribute)) {
      errors.push(`Invalid course attribute: ${course.attribute}`);
    }
    if (!['enabled', 'disabled'].includes(course.status)) {
      errors.push(`Invalid status: ${course.status}`);
    }
    if (!Array.isArray(course.authorizedCampusIds)) {
      errors.push('authorizedCampusIds must be an array');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static filterCourses(courses, query = {}) {
    return courses.filter(c => {
      if (query.status && query.status !== 'all' && c.status !== query.status) {
        return false;
      }
      if (query.grade && query.grade !== 'all' && c.grade !== query.grade) {
        return false;
      }
      if (query.attribute && query.attribute !== 'all' && c.attribute !== query.attribute) {
        return false;
      }
      if (query.campusId && !c.authorizedCampusIds.includes(query.campusId)) {
        return false;
      }
      if (query.keyword) {
        const kw = query.keyword.trim().toLowerCase();
        const matchesName = (c.name || '').toLowerCase().includes(kw);
        const matchesCode = (c.code || '').toLowerCase().includes(kw);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }

  static reorderLessons(unit, fromIndex, toIndex) {
    if (!unit.lessons || !Array.isArray(unit.lessons)) {
      throw new Error('Unit must contain a lessons array');
    }
    if (fromIndex < 0 || fromIndex >= unit.lessons.length || toIndex < 0 || toIndex >= unit.lessons.length) {
      throw new Error(`Invalid drag-and-drop index range: [${fromIndex}, ${toIndex}]`);
    }
    const updated = [...unit.lessons];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated.map((item, idx) => ({ ...item, order: idx + 1 }));
  }

  static canSchedule(course) {
    if (course.status === 'disabled') {
      return { allowed: false, reason: 'Course is disabled' };
    }
    return { allowed: true };
  }
}

module.exports = CurriculumModel;
