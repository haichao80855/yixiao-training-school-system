/**
 * 教务三维冲突检测与 Lane 排课算法模型 (Collision Engine & Lane Allocator)
 * 对应 PROJECT.md § Interface Contracts 3 & Features 15, 16, 17, 18
 */

class CollisionEngine {
  static parseTimeToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) {
      throw new Error(`Invalid time format: ${hhmm}, expected HH:mm`);
    }
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new Error(`Invalid time value: ${hhmm}`);
    }
    return h * 60 + m;
  }

  static isOverlapping(startA, endA, startB, endB) {
    const sA = typeof startA === 'string' ? this.parseTimeToMinutes(startA) : startA;
    const eA = typeof endA === 'string' ? this.parseTimeToMinutes(endA) : endA;
    const sB = typeof startB === 'string' ? this.parseTimeToMinutes(startB) : startB;
    const eB = typeof endB === 'string' ? this.parseTimeToMinutes(endB) : endB;

    if (eA <= sA || eB <= sB) {
      throw new Error('End time must be strictly after start time');
    }

    // 半闭半开区间碰撞公式: max(sA, sB) < min(eA, eB)
    return Math.max(sA, sB) < Math.min(eA, eB);
  }

  static validateScheduleTimeWindow(startTime, endTime) {
    const startMin = this.parseTimeToMinutes(startTime);
    const endMin = this.parseTimeToMinutes(endTime);

    if (endMin <= startMin) {
      return { valid: false, reason: 'End time must be strictly after start time' };
    }

    // 07:00 (420 min) ~ 22:00 (1320 min)
    const DAY_START = 7 * 60; // 420
    const DAY_END = 22 * 60;  // 1320

    if (startMin < DAY_START) {
      return { valid: false, reason: 'Schedule start time cannot be earlier than 07:00' };
    }
    if (endMin > DAY_END) {
      return { valid: false, reason: 'Schedule end time cannot exceed 22:00 (cross-midnight or overtime blocked)' };
    }

    return { valid: true, durationMinutes: endMin - startMin };
  }

  // 3D 碰撞检测
  static detectCollision(targetEvent, existingEvents = [], classrooms = {}) {
    const timeCheck = this.validateScheduleTimeWindow(targetEvent.startTime, targetEvent.endTime);
    if (!timeCheck.valid) {
      return { hasConflict: true, conflictType: 'TIME_WINDOW_VIOLATION', reason: timeCheck.reason };
    }

    // 教室容量校验
    if (targetEvent.classroomId && classrooms[targetEvent.classroomId]) {
      const maxCap = classrooms[targetEvent.classroomId].capacity;
      const studentCount = (targetEvent.studentIds || []).length;
      if (maxCap && studentCount > maxCap) {
        return {
          hasConflict: true,
          conflictType: 'CLASSROOM_CAPACITY_EXCEEDED',
          reason: `Classroom capacity is ${maxCap}, but ${studentCount} students assigned`,
        };
      }
    }

    const conflicts = [];
    const tStart = this.parseTimeToMinutes(targetEvent.startTime);
    const tEnd = this.parseTimeToMinutes(targetEvent.endTime);

    for (const event of existingEvents) {
      if (targetEvent.excludeEventId && event.id === targetEvent.excludeEventId) {
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

      // 1. 教师冲突
      if (targetEvent.teacherId && event.teacherId && targetEvent.teacherId === event.teacherId) {
        conflicts.push({
          type: 'TEACHER_CONFLICT',
          eventId: event.id,
          teacherId: targetEvent.teacherId,
          reason: `Teacher ${targetEvent.teacherId} is already booked for event ${event.id} from ${event.startTime} to ${event.endTime}`,
        });
      }

      // 2. 教室占用冲突
      if (targetEvent.classroomId && event.classroomId && targetEvent.classroomId === event.classroomId) {
        conflicts.push({
          type: 'CLASSROOM_CONFLICT',
          eventId: event.id,
          classroomId: targetEvent.classroomId,
          reason: `Classroom ${targetEvent.classroomId} is occupied by event ${event.id} from ${event.startTime} to ${event.endTime}`,
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
            reason: `Students [${overlappingStudents.join(', ')}] already scheduled in event ${event.id}`,
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      reason: conflicts.length > 0 ? conflicts.map(c => c.reason).join('; ') : null,
    };
  }

  // Lane 自适应并列多列排课算法
  static allocateLanes(eventsOnSameDay, maxLanes = 4) {
    if (!eventsOnSameDay || eventsOnSameDay.length === 0) return [];

    // 按开始时间正序，结束时间倒序排列
    const sorted = [...eventsOnSameDay].map(e => ({
      ...e,
      startMin: this.parseTimeToMinutes(e.startTime),
      endMin: this.parseTimeToMinutes(e.endTime),
    })).sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

    // 计算联通重叠组 (Overlap Clusters)
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    for (const evt of sorted) {
      if (currentCluster.length === 0) {
        currentCluster.push(evt);
        clusterEnd = evt.endMin;
      } else {
        if (evt.startMin < clusterEnd) {
          // 重叠，加入同一组
          currentCluster.push(evt);
          clusterEnd = Math.max(clusterEnd, evt.endMin);
        } else {
          // 不重叠，新起一组
          clusters.push(currentCluster);
          currentCluster = [evt];
          clusterEnd = evt.endMin;
        }
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    const result = [];

    // 对每个重叠群进行贪心染色 Lane 分配
    for (const cluster of clusters) {
      const laneEndTimes = []; // 每条 Lane 的当前结束时间

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
        const topPx = (evt.startMin - 420); // 1小时60px，即1分钟1px
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
            left: `${leftPercent}%`,
          },
        });
      }
    }

    return result;
  }

  // 四色语义 Chip 判定
  static getSemanticChipStyle(event) {
    if (event.hasConflict) {
      return {
        type: 'conflict',
        badge: '冲突',
        background: '#FEF0F0',
        borderColor: '#F56C6C',
        color: '#F56C6C',
      };
    }
    if (event.status === 'completed' || event.isFinished) {
      return {
        type: 'completed',
        badge: '已上',
        background: '#F0F9EB',
        borderColor: '#67C23A',
        color: '#67C23A',
      };
    }
    if (event.isPersonal || event.type === 'personal') {
      return {
        type: 'personal',
        badge: '个人',
        background: '#F9F0FF',
        borderColor: '#722ED1',
        color: '#722ED1',
      };
    }
    return {
      type: 'regular',
      badge: '正',
      background: '#ECF5FF',
      borderColor: '#409EFF',
      color: '#409EFF',
    };
  }
}

module.exports = CollisionEngine;
