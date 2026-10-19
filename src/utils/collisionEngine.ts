import type {
  ScheduleEvent,
  Classroom,
  CollisionResult,
  ConflictItem,
  LaneEvent,
  ScheduleSemanticType
} from '@/types/educational';

export class EducationalCollisionEngine {
  /**
   * 将 HH:mm 格式时间转换为从 00:00 起始的分钟数
   */
  static parseTimeToMinutes(hhmm: string): number {
    if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) {
      throw new Error(`Invalid time format: ${hhmm}, expected HH:mm`);
    }
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new Error(`Invalid time value: ${hhmm}`);
    }
    return h * 60 + m;
  }

  /**
   * 半闭半开区间重叠算法: max(sA, sB) < min(eA, eB)
   */
  static isOverlapping(startA: string | number, endA: string | number, startB: string | number, endB: string | number): boolean {
    const sA = typeof startA === 'string' ? this.parseTimeToMinutes(startA) : startA;
    const eA = typeof endA === 'string' ? this.parseTimeToMinutes(endA) : endA;
    const sB = typeof startB === 'string' ? this.parseTimeToMinutes(startB) : startB;
    const eB = typeof endB === 'string' ? this.parseTimeToMinutes(endB) : endB;

    if (eA <= sA || eB <= sB) {
      throw new Error('End time must be strictly after start time');
    }

    return Math.max(sA, sB) < Math.min(eA, eB);
  }

  /**
   * 07:00 ~ 22:00 排课时间窗口合法性与跨午夜校验
   */
  static validateScheduleTimeWindow(startTime: string, endTime: string): { valid: boolean; reason?: string; durationMinutes?: number } {
    const startMin = this.parseTimeToMinutes(startTime);
    const endMin = this.parseTimeToMinutes(endTime);

    if (endMin <= startMin) {
      return { valid: false, reason: 'End time must be strictly after start time' };
    }

    const DAY_START = 7 * 60; // 420 (07:00)
    const DAY_END = 22 * 60;  // 1320 (22:00)

    if (startMin < DAY_START) {
      return { valid: false, reason: 'Schedule start time cannot be earlier than 07:00' };
    }
    if (endMin > DAY_END) {
      return { valid: false, reason: 'Schedule end time cannot exceed 22:00 (cross-midnight or overtime blocked)' };
    }

    return { valid: true, durationMinutes: endMin - startMin };
  }

  /**
   * 三维冲突检测核心算法 (讲师冲突、教室占用与容量超限冲突、学员并发冲突)
   */
  static detectCollision(
    targetEvent: Partial<ScheduleEvent> & { startTime: string; endTime: string; date: string },
    existingEvents: ScheduleEvent[] = [],
    classrooms: Record<string, Classroom> | Classroom[] = []
  ): CollisionResult {
    const timeCheck = this.validateScheduleTimeWindow(targetEvent.startTime, targetEvent.endTime);
    if (!timeCheck.valid) {
      return {
        hasConflict: true,
        conflictType: 'TIME_WINDOW_VIOLATION',
        reason: timeCheck.reason,
        conflicts: [{ type: 'TIME_WINDOW_VIOLATION', reason: timeCheck.reason || '时间窗口非法' }]
      };
    }

    // 教室容量校验
    const classroomMap: Record<string, Classroom> = Array.isArray(classrooms)
      ? classrooms.reduce((acc, c) => ({ ...acc, [c.id]: c }), {})
      : classrooms;

    if (targetEvent.classroomId && classroomMap[targetEvent.classroomId]) {
      const maxCap = classroomMap[targetEvent.classroomId].capacity;
      const studentCount = (targetEvent.studentIds || []).length;
      if (maxCap && studentCount > maxCap) {
        const reason = `Classroom capacity is ${maxCap}, but ${studentCount} students assigned`;
        return {
          hasConflict: true,
          conflictType: 'CLASSROOM_CAPACITY_EXCEEDED',
          reason,
          conflicts: [{ type: 'CLASSROOM_CAPACITY_EXCEEDED', classroomId: targetEvent.classroomId, reason }]
        };
      }
    }

    const conflicts: ConflictItem[] = [];
    const tStart = this.parseTimeToMinutes(targetEvent.startTime);
    const tEnd = this.parseTimeToMinutes(targetEvent.endTime);

    for (const event of existingEvents) {
      if (targetEvent.excludeEventId && event.id === targetEvent.excludeEventId) {
        continue;
      }
      if (targetEvent.id && event.id === targetEvent.id) {
        continue;
      }
      if (targetEvent.date !== event.date) {
        continue;
      }

      const eStart = this.parseTimeToMinutes(event.startTime);
      const eEnd = this.parseTimeToMinutes(event.endTime);

      if (!this.isOverlapping(tStart, tEnd, eStart, eEnd)) {
        continue;
      }

      // 1. 讲师冲突
      if (targetEvent.teacherId && event.teacherId && targetEvent.teacherId === event.teacherId) {
        conflicts.push({
          type: 'TEACHER_CONFLICT',
          eventId: event.id,
          teacherId: targetEvent.teacherId,
          reason: `Teacher ${targetEvent.teacherId} is already booked for event ${event.id} from ${event.startTime} to ${event.endTime}`
        });
      }

      // 2. 教室占用冲突
      if (targetEvent.classroomId && event.classroomId && targetEvent.classroomId === event.classroomId) {
        conflicts.push({
          type: 'CLASSROOM_CONFLICT',
          eventId: event.id,
          classroomId: targetEvent.classroomId,
          reason: `Classroom ${targetEvent.classroomId} is occupied by event ${event.id} from ${event.startTime} to ${event.endTime}`
        });
      }

      // 3. 学员排课冲突
      if (Array.isArray(targetEvent.studentIds) && Array.isArray(event.studentIds)) {
        const overlappingStudents = targetEvent.studentIds.filter(id => event.studentIds.includes(id));
        if (overlappingStudents.length > 0) {
          conflicts.push({
            type: 'STUDENT_CONFLICT',
            eventId: event.id,
            studentIds: overlappingStudents,
            reason: `Students [${overlappingStudents.join(', ')}] already scheduled in event ${event.id}`
          });
        }
      }
    }

    const hasConflict = conflicts.length > 0;
    return {
      hasConflict,
      conflicts,
      conflictType: conflicts[0]?.type,
      reason: hasConflict ? conflicts.map(c => c.reason).join('; ') : null,
      teacherConflict: conflicts.some(c => c.type === 'TEACHER_CONFLICT'),
      classroomConflict: conflicts.some(c => c.type === 'CLASSROOM_CONFLICT'),
      studentConflicts: conflicts
        .filter(c => c.type === 'STUDENT_CONFLICT')
        .flatMap(c => c.studentIds || []),
      conflictingEvents: existingEvents.filter(e => conflicts.some(c => c.eventId === e.id))
    };
  }

  /**
   * Lane 染色多列自适应并列排布算法 (最大 4 列)
   */
  static allocateLanes(eventsOnSameDay: ScheduleEvent[], maxLanes = 4): LaneEvent[] {
    if (!eventsOnSameDay || eventsOnSameDay.length === 0) return [];

    // 按开始时间正序，结束时间倒序排列
    const sorted = [...eventsOnSameDay].map(e => ({
      ...e,
      startMin: this.parseTimeToMinutes(e.startTime),
      endMin: this.parseTimeToMinutes(e.endTime),
      laneIndex: 0
    })).sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

    // 计算联通重叠组 (Overlap Clusters)
    const clusters: (typeof sorted)[] = [];
    let currentCluster: typeof sorted = [];
    let clusterEnd = -1;

    for (const evt of sorted) {
      if (currentCluster.length === 0) {
        currentCluster.push(evt);
        clusterEnd = evt.endMin;
      } else {
        if (evt.startMin < clusterEnd) {
          currentCluster.push(evt);
          clusterEnd = Math.max(clusterEnd, evt.endMin);
        } else {
          clusters.push(currentCluster);
          currentCluster = [evt];
          clusterEnd = evt.endMin;
        }
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    const result: LaneEvent[] = [];

    // 对每个重叠群进行贪心染色 Lane 分配
    for (const cluster of clusters) {
      const laneEndTimes: number[] = [];

      for (const evt of cluster) {
        let placedLane = -1;
        for (let l = 0; l < laneEndTimes.length; l++) {
          if (laneEndTimes[l] <= evt.startMin) {
            placedLane = l;
            laneEndTimes[l] = evt.endMin;
            break;
          }
        }
        if (placedLane === -1) {
          placedLane = laneEndTimes.length;
          laneEndTimes.push(evt.endMin);
        }
        evt.laneIndex = placedLane;
      }

      const totalLanes = Math.min(laneEndTimes.length, maxLanes);
      const laneWidthPercent = Number((100 / totalLanes).toFixed(2));

      for (const evt of cluster) {
        const lane = Math.min(evt.laneIndex, totalLanes - 1);
        const topPx = (evt.startMin - 420); // 07:00 起始，1小时60px => 1分钟1px
        const heightPx = (evt.endMin - evt.startMin);
        const leftPercent = Number((lane * laneWidthPercent).toFixed(2));

        result.push({
          id: evt.id,
          date: evt.date,
          startTime: evt.startTime,
          endTime: evt.endTime,
          laneIndex: lane,
          totalLanes,
          style: {
            top: `${topPx}px`,
            height: `${heightPx}px`,
            width: `${laneWidthPercent}%`,
            left: `${leftPercent}%`
          },
          event: evt
        });
      }
    }

    return result;
  }

  /**
   * 四色语义 Chip 判定
   */
  static getSemanticChipStyle(event: Partial<ScheduleEvent> & { hasConflict?: boolean; status?: string; isFinished?: boolean; isPersonal?: boolean; type?: string; semanticType?: ScheduleSemanticType }) {
    if (event.hasConflict || event.semanticType === 'conflict') {
      return {
        type: 'conflict',
        badge: '冲突',
        background: 'var(--st-color-danger-light, #FEF0F0)',
        borderColor: 'var(--st-color-danger, #F56C6C)',
        color: 'var(--st-color-danger, #F56C6C)'
      };
    }
    if (event.status === 'completed' || event.isFinished || event.semanticType === 'completed') {
      return {
        type: 'completed',
        badge: '已上',
        background: 'var(--st-color-success-light, #F0F9EB)',
        borderColor: 'var(--st-color-success, #67C23A)',
        color: 'var(--st-color-success, #67C23A)'
      };
    }
    if (event.isPersonal || event.type === 'personal' || event.semanticType === 'personal') {
      return {
        type: 'personal',
        badge: '个人',
        background: 'var(--st-color-purple-light, #F9F0FF)',
        borderColor: 'var(--st-color-purple, #722ED1)',
        color: 'var(--st-color-purple, #722ED1)'
      };
    }
    return {
      type: 'regular',
      badge: '正',
      background: 'var(--st-color-primary-light, #ECF5FF)',
      borderColor: 'var(--st-color-primary, #409EFF)',
      color: 'var(--st-color-primary, #409EFF)'
    };
  }
}
