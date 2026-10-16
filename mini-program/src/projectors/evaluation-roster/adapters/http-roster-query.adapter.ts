import { eduApi } from '../../../api/edu';
import type { RosterQueryPort, RosterScheduleDto, RosterWorkbenchDto } from '../ports';

export class HttpRosterQueryAdapter implements RosterQueryPort {
  async fetchCampusSchedules(
    campusId: string,
    dateRange?: string | { startDate: string; endDate: string }
  ): Promise<RosterScheduleDto[]> {
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (dateRange) {
      if (typeof dateRange === 'string') {
        const parts = dateRange.split(/[\s至~到-]+/).map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          startDate = parts[0];
          endDate = parts[1];
        } else if (parts.length === 1) {
          startDate = parts[0];
          endDate = parts[0];
        }
      } else {
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }
    }

    const schedules = await eduApi.getSchedules({
      campusId,
      startDate,
      endDate,
    });

    return (schedules || []).map((s) => ({
      id: s.id,
      campusId: s.campusId,
      classId: s.classId,
      className: s.className,
      courseName: s.courseName,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      classType: s.classType,
    }));
  }

  async fetchScheduleWorkbench(scheduleId: string): Promise<RosterWorkbenchDto> {
    const workbench = await eduApi.getFulfillmentWorkbench(scheduleId);
    return {
      schedule: {
        id: workbench.schedule.id,
        campusId: workbench.schedule.campusId,
        className: workbench.schedule.className,
        date: workbench.schedule.date,
        startTime: workbench.schedule.startTime,
        endTime: workbench.schedule.endTime,
        classType: workbench.schedule.classType,
      },
      students: (workbench.students || []).map((s) => ({
        studentId: s.studentId,
        studentNo: s.studentNo,
        name: s.name,
        phone: s.phone,
        remainingLessons: s.remainingLessons,
        evaluated: s.evaluated,
        status: s.status,
        isPushed: Boolean(s.evaluated),
      })),
    };
  }
}
