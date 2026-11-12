# 测试基础设施说明 (TEST_INFRA)

本文说明现在的测试怎么组织、怎么运行。改进计划和各期进展见 [docs/test-improvement-plan.md](docs/test-improvement-plan.md)。

> 以前的「Tier 1~5 分层用例」测的是 `tests/contracts/` 里手写的业务模型，以及前端已经不再使用的 `src/mocks` 示例数据，不是系统真正运行的代码。这些内容已在测试改进第 2 期删除；其中能对应真实代码的用例改写到了 `tests/unit/`。

## 一、怎么运行

| 命令 | 作用 |
|---|---|
| `npm run test:all` | 运行 `tests/suites.json` 登记的全部测试 (部署门禁、CI 都用它) |
| `npm run test:server` | 只运行后端测试 |
| `npm run test:all -- --group=资金` | 按分组名筛选 |
| `npm run test:all -- --file=teacher-pay` | 按文件名筛选 |
| `npm run test:all -- --keep` | 跑完保留临时目录 (测试库、上传文件、后端日志)，方便排查 |
| `node tests/run-suite.cjs --list` | 列出清单，不运行 |
| `node tests/runner.js` | 只运行前端工具函数单元测试 (`tests/unit/`，不需要后端) |

所有命令都在**隔离环境**里运行 (`tests/isolated-env.cjs`)：

1. 在系统临时目录建一个新的 SQLite 测试库，执行 `prisma db push` 并写入种子数据。
2. 在随机端口启动 `server/dist/main.js`；后端源码比构建产物新时会先自动重新构建。
3. 运行测试，结束后关闭后端、删除临时目录。

3001 端口的开发服务器和 `server/prisma/dev.db` 不会被碰到。

## 二、测试清单 `tests/suites.json`

- **唯一清单**：全部测试按领域分组登记在这里，`test:all`、`test:server`、部署门禁和 CI 都只读这一份。
- **漏登记会报错**：`server/test-*.js` 或 `tests/` 顶层的脚本没有登记时，运行器直接报错。新增测试必须先登记。
- **`needs` 声明前置条件**：
  - `server`：需要运行中的后端和测试库。
  - `server-dist`：需要先构建后端。
  - `mp-dist` / `h5-dist`：需要先构建小程序 / 家长端 H5。构建产物不存在或比 `mini-program/src` 旧时会跳过，避免拿旧代码测试。
- **`skip` 记录已知原因**：已知暂时不能运行的测试登记跳过原因，汇总里能看到，不会悄悄消失。

## 三、目录

| 位置 | 内容 |
|---|---|
| `server/test-*.js` | 后端接口与领域测试，自建夹具，连真实后端和测试库 |
| `tests/*.cjs` | 全栈集成、点名课评集成、小程序契约与源码静态检查 |
| `tests/unit/*.test.js` | 前端 `src/utils` 的单元测试，通过 `tests/helpers/load-ts.cjs` 直接加载真实 TypeScript 源码 |
| `server/test-utils/target.js` | 测试连接的后端地址 (`TEST_BASE_URL` > `PORT` > 3001) |
| `server/test-utils/accounts.js` | 测试登录用的种子账号和密码 |
| `tests/run-suite.cjs` / `tests/isolated-env.cjs` / `tests/env-guard.cjs` | 运行器、隔离环境、环境保护 |

## 四、写测试的规则

1. **用统一的地址和账号。**
   - 后端地址从 `server/test-utils/target.js` 取。
   - 登录账号从 `server/test-utils/accounts.js` 取。
   - 不要写死端口、主机、账号和密码。
2. **数据库连接用默认的 `new PrismaClient()`**（读 `DATABASE_URL`），不要写死 `dev.db` 路径。
3. **自建夹具、按 ID 清理。**
   - 不要依赖开发库里已有的某条数据，例如写死一个排课 ID。
   - 不要假设库里只有自己的数据。同一轮里其他测试也会写库；需要统计数量时，先读基线，再核对增量。
4. **测真实代码。** 不要在测试里另写一份业务逻辑再去测它。前端纯函数用 `load-ts.cjs` 加载 `src/` 下的源码。
5. **能用业务角色就不用超管。** 用校长、老师、财务账号才能发现权限问题。

## 五、环境保护与残留检查

- **环境保护** (`tests/env-guard.cjs`)：
  - 远程后端地址一律拒绝。
  - 没设 `DATABASE_URL`、指向 `dev.db`、或连 3001 端口时默认拒绝；确实需要时加 `--allow-dev-db`。
- **残留检查**：
  - 在隔离环境里，运行器会在每个需要后端的测试前后统计测试库各表的行数。
  - 测试跑完多出来的行，记入汇总的「清理遗漏」，并把纯新增的行删掉，保证下一个测试面对的仍是原来的库。
  - 测试如果改动过原有数据（例如重设角色权限），运行器不会自动恢复，只报告。
  - 这一步只对系统临时目录下的测试库执行。

## 六、持续集成与部署门禁

- **CI**：`.github/workflows/ci.yml` 在每个 PR 和 `main` 的推送上运行：
  - `lint:ui`
  - `build`（含类型检查）
  - 首屏体积检查 `check:bundle`
  - 后端构建
  - 全部测试（临时库）
- **部署门禁**：`deploy/deploy-to-aliyun.sh` 构建完成后先跑 `npm run test:all`，有失败就停止部署，线上不做任何改动。紧急情况可以加 `--skip-tests`，会打印警告。
