/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎
 * 纯内存测试上下文构建器 (TestActorBuilder - Test Standin Adapter)
 * 允许在零网络、零数据库、零框架依赖下，毫秒级装配与运行数据隔离单测用例
 * ==============================================================================
 */

import { ActorContext, SupportedDataScope } from '../domain/data-scope.types';

export class TestActorBuilder {
  private actor: ActorContext = {
    userId: 'test-user-001',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    dataScope: 'campus',
    roles: ['staff'],
    permissions: ['student:view'],
    isSuperAdmin: false,
    isBypassed: false,
  };

  public static standardCampusUser(campusId = 'campus-bj-hq'): TestActorBuilder {
    return new TestActorBuilder().withCampus(campusId);
  }

  public static superAdmin(): TestActorBuilder {
    return new TestActorBuilder()
      .withScope('all')
      .withCampus('all')
      .asSuperAdmin(true);
  }

  public static teacher(campusId = 'campus-bj-hq', teacherId = 't-001'): TestActorBuilder {
    return new TestActorBuilder()
      .withCampus(campusId)
      .withScope('self')
      .withTeacher(teacherId);
  }

  public withUserId(userId: string): this {
    (this.actor as any).userId = userId;
    return this;
  }

  public withCampus(campusId: string, campusName?: string): this {
    (this.actor as any).campusId = campusId;
    if (campusName) {
      (this.actor as any).campusName = campusName;
    }
    return this;
  }

  public withScope(dataScope: SupportedDataScope): this {
    (this.actor as any).dataScope = dataScope;
    return this;
  }

  public withTeacher(teacherId: string): this {
    (this.actor as any).teacherId = teacherId;
    return this;
  }

  public withDepartment(departmentId: string): this {
    (this.actor as any).departmentId = departmentId;
    return this;
  }

  public asSuperAdmin(isSuper: boolean): this {
    (this.actor as any).isSuperAdmin = isSuper;
    return this;
  }

  public asBypassed(bypassed: boolean): this {
    (this.actor as any).isBypassed = bypassed;
    return this;
  }

  public build(): ActorContext {
    return { ...this.actor };
  }
}
