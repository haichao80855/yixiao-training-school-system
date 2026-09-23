/**
 * Milestone 2 课程管理与编辑器对抗测试启动入口 (ESM Wrapper)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./tests/challenge_test.js');
