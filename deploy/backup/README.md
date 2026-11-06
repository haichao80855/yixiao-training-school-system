# 数据库每日备份

每天 03:30 生成一致性快照，校验、压缩后保留在本机并上传 OSS。失败或超过 26 小时没有新备份时发送告警。

| 位置 | 保留 | 清理方式 |
|---|---|---|
| 本机 `/opt/yixiao/db-backups/` | 最近 7 份 | 脚本 |
| OSS `daily/` | 30 天 | 生命周期规则 |
| OSS `monthly/`（每月第一份成功的备份） | 365 天 | 生命周期规则 |

定时任务：`yixiao-db-backup`（每天备份）、`yixiao-db-backup-check`（每小时检查）、`yixiao-db-backup-verify`（每月 2 日恢复演练，只校验本机最新备份，不碰线上库）。

## 启用 OSS 和告警

1. 新建 Bucket：与服务器同在华北 2（北京），读写权限为私有。不要复用媒体 Bucket。
2. 在 Bucket 上开启版本控制，防止已有备份被同名上传覆盖。
3. 添加生命周期规则：
   - 前缀 `daily/`：当前版本 30 天后删除，历史版本 30 天后删除。
   - 前缀 `monthly/`：当前版本 365 天后删除，历史版本 30 天后删除。
4. 新建 RAM 用户，只开通 OpenAPI 调用，授予 [oss-ram-policy.json](oss-ram-policy.json)（先替换 Bucket 名称）。这个账号只能上传，不能读取和删除。
5. 新建钉钉或企业微信群机器人。钉钉的安全设置选“自定义关键词”，关键词填“备份”。
6. 在服务器上编辑配置，密钥不要发到聊天或提交到仓库：

   ```bash
   vi /etc/yixiao/db-backup.env
   ```

7. 立即跑一次，然后到 OSS 控制台确认 `daily/` 和 `monthly/` 下都有文件：

   ```bash
   systemctl start yixiao-db-backup.service && journalctl -u yixiao-db-backup.service -n 20 --no-pager
   ```

上传账号没有读取权限，所以脚本和每月演练都读不了 OSS 上的文件。启用后请在控制台下载一份备份和同名的 `.sha256` 文件，放到服务器同一目录后校验（不碰线上库）：

```bash
python3 /opt/yixiao/ops/db-backup/yixiao_db_backup.py verify --file /root/yixiao-db-YYYYMMDD-HHMMSS.sqlite.gz
```

## 查看状态

```bash
systemctl list-timers 'yixiao-db-backup*' --no-pager
cat /opt/yixiao/db-backups/state.json
python3 /opt/yixiao/ops/db-backup/yixiao_db_backup.py check
```

## 恢复

恢复会替换线上数据库并重启服务，备份之后写入的数据会丢失。脚本先校验备份，把当前库保留为 `/opt/yixiao/db-backups/pre-restore-*.sqlite`，重启后健康检查不通过时自动回滚。

```bash
ls -t /opt/yixiao/db-backups/*.sqlite.gz | head
python3 /opt/yixiao/ops/db-backup/yixiao_db_backup.py restore --file /opt/yixiao/db-backups/yixiao-db-YYYYMMDD-HHMMSS.sqlite.gz --yes
```

从 OSS 恢复时，先用主账号在控制台下载备份和同名的 `.sha256` 文件，放到服务器同一目录，再执行同样的命令。

## 安装和测试

```bash
bash deploy/backup/install.sh root@39.107.33.4
```

```bash
npm run test:backup
```

部署脚本只更新 `yixiao_db_backup.py`。修改 `systemd/` 下的定时任务后，需要重新运行安装脚本。
