export interface RosterScheduleDto {
  id: string;
  campusId: string;
  classId: string;
  className: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  classType?: string;
}

export interface RosterStudentDto {
  studentId: string;
  studentNo?: string;
  name: string;
  phone?: string;
  remainingLessons?: number;
  evaluated?: boolean;
  status?: string;
  isPushed?: boolean;
}

export interface RosterWorkbenchDto {
  schedule: {
    id: string;
    campusId: string;
    className: string;
    date: string;
    startTime: string;
    endTime: string;
    classType?: string;
  };
  students: RosterStudentDto[];
}

export interface RosterQueryPort {
  /**
   * 拉取指定校区和日期范围内的排课日程
   */
  fetchCampusSchedules(
    campusId: string,
    dateRange?: string | { startDate: string; endDate: string }
  ): Promise<RosterScheduleDto[]>;

  /**
   * 拉取指定排课日程的履约工作台（包含考勤和课评履约状态）
   */
  fetchScheduleWorkbench(scheduleId: string): Promise<RosterWorkbenchDto>;
}

export interface RosterCachePort {
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttlMs?: number): void;
  remove(key: string): void;
  clearByPrefix(prefix: string): void;
}
