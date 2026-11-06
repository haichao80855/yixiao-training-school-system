#!/usr/bin/env bash
# 把备份工具和定时任务装到生产服务器。可重复执行，不会覆盖已有的配置文件。
# 用法（在仓库根目录）：bash deploy/backup/install.sh root@39.107.33.4
set -euo pipefail

REMOTE_HOST="${1:?用法: bash deploy/backup/install.sh <ssh 主机>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COPYFILE_DISABLE=1

ssh "$REMOTE_HOST" "install -d -m 755 /opt/yixiao/ops/db-backup && install -d -m 700 /etc/yixiao"
rsync -av --exclude="._*" \
  "$HERE/yixiao_db_backup.py" "$HERE/db-backup.env.example" \
  "$REMOTE_HOST:/opt/yixiao/ops/db-backup/"
rsync -av --exclude="._*" "$HERE/systemd/" "$REMOTE_HOST:/etc/systemd/system/"

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
set -euo pipefail
chown root:root /opt/yixiao/ops/db-backup/* /etc/systemd/system/yixiao-db-backup*
chmod 644 /etc/systemd/system/yixiao-db-backup*
if [ ! -f /etc/yixiao/db-backup.env ]; then
  install -m 600 /opt/yixiao/ops/db-backup/db-backup.env.example /etc/yixiao/db-backup.env
  echo "已创建 /etc/yixiao/db-backup.env，请填写 OSS 和告警配置"
fi
systemctl daemon-reload
systemctl enable --now yixiao-db-backup.timer yixiao-db-backup-check.timer yixiao-db-backup-verify.timer
systemctl list-timers 'yixiao-db-backup*' --no-pager
EOF
