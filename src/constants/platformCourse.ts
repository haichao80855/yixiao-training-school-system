import platformData from '@/mocks/shengtongPlatformCourses.json';

/**
 * 平台课程的课次与课件明细 (共 118 门、约 2.4 MB)：按 courseCode 拆成单独文件，
 * 打开某门课的详情抽屉时才加载那一门，避免整份数据打进课程库页面的 JS。
 */
const coursewareLoaders = import.meta.glob<Record<string, any>>(
  '../mocks/platform-coursewares/*.json',
  { import: 'default' },
);

export async function loadPlatformCoursewares(courseCode: string): Promise<Record<string, any> | null> {
  const loader = coursewareLoaders[`../mocks/platform-coursewares/${courseCode}.json`];
  if (!loader) return null;
  try {
    return await loader();
  } catch (err) {
    console.warn(`[platformCourse] 课件明细加载失败: ${courseCode}`, err);
    return null;
  }
}

export { platformData };
