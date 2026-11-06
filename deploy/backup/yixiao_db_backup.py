#!/usr/bin/env python3
"""一校教培系统 SQLite 数据库备份工具（仅依赖 Python 标准库）。

子命令：
  backup   生成一致性快照、校验、压缩、保留本机副本并上传 OSS
  check    检查最近一次备份是否过期，过期则告警
  verify   恢复演练：把最新的本机备份解压到临时目录并校验，不碰线上库
  restore  用指定备份替换线上库（需要 --file 和 --yes）

配置来自 /etc/yixiao/db-backup.env（可用 BACKUP_ENV_FILE 指定），环境变量优先。
未配置 OSS 时只保留本机副本。说明见同目录 README.md。
"""
import argparse
import base64
import email.utils
import fcntl
import gzip
import hashlib
import hmac
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

FILE_RE = re.compile(r"^yixiao-db-\d{8}-\d{6}\.sqlite\.gz$")
CORE_TABLES = ("Company", "User", "Role")
LOCAL_KEEP = 7
STALE_SECONDS = 26 * 3600
ALERT_INTERVAL_SECONDS = 6 * 3600
OSS_KEYS = (
    "BACKUP_OSS_ENDPOINT",
    "BACKUP_OSS_BUCKET",
    "BACKUP_OSS_ACCESS_KEY_ID",
    "BACKUP_OSS_ACCESS_KEY_SECRET",
)


class BackupError(Exception):
    pass


def log(message):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), message, flush=True)


def load_config():
    config = {}
    path = os.environ.get("BACKUP_ENV_FILE", "/etc/yixiao/db-backup.env")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip().strip("\"'")
    for key, value in os.environ.items():
        if key.startswith(("BACKUP_", "ALERT_")):
            config[key] = value
    config.setdefault("BACKUP_DB_PATH", "/opt/yixiao/server/prisma/dev.db")
    config.setdefault("BACKUP_LOCAL_DIR", "/opt/yixiao/db-backups")
    config.setdefault("BACKUP_SERVICE_NAME", "yixiao-server")
    config.setdefault("BACKUP_SYSTEMCTL", "systemctl")
    config.setdefault("BACKUP_HEALTH_URL", "http://127.0.0.1:3001/api/health")
    config.setdefault("BACKUP_RETRY_DELAY", "20")
    return config


def oss_enabled(config):
    present = [key for key in OSS_KEYS if config.get(key)]
    if present and len(present) != len(OSS_KEYS):
        missing = sorted(set(OSS_KEYS) - set(present))
        raise BackupError("OSS 配置不完整，缺少: " + ", ".join(missing))
    return bool(present)


# ---------- 状态与告警 ----------


def state_path(config):
    return os.path.join(config["BACKUP_LOCAL_DIR"], "state.json")


def read_state(config):
    try:
        with open(state_path(config), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def write_state(config, state):
    path = state_path(config)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def send_alert(config, message):
    """钉钉和企业微信的群机器人都接受这个文本格式。告警失败不能掩盖原始错误。"""
    text = "【数据库备份告警】%s：%s" % (socket.gethostname(), message)
    log(text)
    url = config.get("ALERT_WEBHOOK_URL")
    if not url:
        log("未配置 ALERT_WEBHOOK_URL，告警只写入日志")
        return False
    body = json.dumps({"msgtype": "text", "text": {"content": text}}).encode()
    request = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read()
        return True
    except (urllib.error.URLError, OSError) as err:
        # 异常信息可能带 webhook 的 token，只记录类型
        log("告警发送失败: %s" % type(err).__name__)
        return False


# ---------- 快照与校验 ----------


def inspect_database(path):
    """完整性检查并确认核心表非空，返回各核心表行数。"""
    conn = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
    try:
        result = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if result != "ok":
            raise BackupError("完整性检查未通过: %s" % str(result)[:200])
        counts = {}
        for table in CORE_TABLES:
            counts[table] = conn.execute('SELECT COUNT(*) FROM "%s"' % table).fetchone()[0]
            if counts[table] == 0:
                raise BackupError("核心表 %s 为空" % table)
        return counts
    except sqlite3.Error as err:
        raise BackupError("无法读取数据库: %s" % err)
    finally:
        conn.close()


def snapshot_database(source_path, target_path):
    """用 SQLite 备份接口导出。运行中的库直接 cp 可能得到不一致的副本。"""
    source = sqlite3.connect("file:%s?mode=ro" % source_path, uri=True, timeout=30)
    target = sqlite3.connect(target_path)
    try:
        source.backup(target, pages=256, sleep=0.05)
    except sqlite3.Error as err:
        raise BackupError("生成快照失败: %s" % err)
    finally:
        target.close()
        source.close()


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prune_local(config):
    directory = config["BACKUP_LOCAL_DIR"]
    names = sorted(name for name in os.listdir(directory) if FILE_RE.match(name))
    for name in names[:-LOCAL_KEEP]:
        os.remove(os.path.join(directory, name))
        sidecar = os.path.join(directory, name + ".sha256")
        if os.path.exists(sidecar):
            os.remove(sidecar)
        log("已清理旧的本机备份 %s" % name)


# ---------- OSS ----------


def oss_signature(secret, verb, content_md5, content_type, date, oss_headers, resource):
    canonical_headers = "".join(
        "%s:%s\n" % (key.lower(), oss_headers[key])
        for key in sorted(oss_headers, key=str.lower)
    )
    to_sign = "\n".join((verb, content_md5, content_type, date, canonical_headers + resource))
    mac = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha1).digest()
    return base64.b64encode(mac).decode()


def oss_put(config, key, data, content_type):
    endpoint = config["BACKUP_OSS_ENDPOINT"]
    bucket = config["BACKUP_OSS_BUCKET"]
    url = (
        "%s/%s" % (endpoint.rstrip("/"), key)
        if endpoint.startswith("http")
        else "https://%s.%s/%s" % (bucket, endpoint, key)
    )
    content_md5 = base64.b64encode(hashlib.md5(data).digest()).decode()
    date = email.utils.formatdate(usegmt=True)
    # 备份文件名带时间戳，禁止覆盖可以防止同名对象被意外改写
    oss_headers = {
        "x-oss-forbid-overwrite": "true",
        "x-oss-server-side-encryption": "AES256",
    }
    signature = oss_signature(
        config["BACKUP_OSS_ACCESS_KEY_SECRET"],
        "PUT",
        content_md5,
        content_type,
        date,
        oss_headers,
        "/%s/%s" % (bucket, key),
    )
    headers = {
        "Authorization": "OSS %s:%s" % (config["BACKUP_OSS_ACCESS_KEY_ID"], signature),
        "Content-MD5": content_md5,
        "Content-Type": content_type,
        "Date": date,
    }
    headers.update(oss_headers)
    request = urllib.request.Request(url, data=data, headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response.read()
    except urllib.error.HTTPError as err:
        detail = err.read()[:300].decode("utf-8", "replace")
        raise BackupError("OSS 返回 %s: %s" % (err.code, detail))
    except (urllib.error.URLError, OSError) as err:
        raise BackupError("连接 OSS 失败: %s" % err)


def upload_with_retry(config, key, data, content_type):
    delay = float(config["BACKUP_RETRY_DELAY"])
    last_error = None
    for attempt in range(3):
        if attempt:
            time.sleep(delay * attempt)
        try:
            oss_put(config, key, data, content_type)
            return
        except BackupError as err:
            last_error = err
            log("上传 %s 第 %d 次失败: %s" % (key, attempt + 1, err))
    raise last_error


def upload_backup(config, path, sha256, prefix):
    name = os.path.basename(path)
    with open(path, "rb") as fh:
        data = fh.read()
    upload_with_retry(config, "%s/%s" % (prefix, name), data, "application/gzip")
    sidecar = ("%s  %s\n" % (sha256, name)).encode()
    upload_with_retry(config, "%s/%s.sha256" % (prefix, name), sidecar, "text/plain")
    log("已上传 %s/%s（%d 字节）" % (prefix, name, len(data)))


# ---------- 子命令 ----------


def create_local_backup(config):
    directory = config["BACKUP_LOCAL_DIR"]
    stamp = time.strftime("%Y%m%d-%H%M%S")
    name = "yixiao-db-%s.sqlite.gz" % stamp
    with tempfile.TemporaryDirectory(dir=directory, prefix=".tmp-") as tmp:
        snapshot = os.path.join(tmp, "snapshot.sqlite")
        snapshot_database(config["BACKUP_DB_PATH"], snapshot)
        counts = inspect_database(snapshot)
        compressed = os.path.join(tmp, name)
        with open(snapshot, "rb") as src, open(compressed, "wb") as raw:
            # mtime=0：相同内容得到相同的压缩结果
            with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as gz:
                shutil.copyfileobj(src, gz)
        sha256 = sha256_file(compressed)
        final = os.path.join(directory, name)
        with open(final + ".sha256", "w", encoding="utf-8") as fh:
            fh.write("%s  %s\n" % (sha256, name))
        os.replace(compressed, final)
    return final, sha256, counts


def command_backup(config):
    enabled = oss_enabled(config)
    path, sha256, counts = create_local_backup(config)
    size = os.path.getsize(path)
    log("本机备份完成 %s（%d 字节），核心表行数 %s" % (path, size, counts))

    state = read_state(config)
    state.update(
        last_local_ts=int(time.time()),
        last_file=os.path.basename(path),
        last_sha256=sha256,
        last_size=size,
    )
    write_state(config, state)
    prune_local(config)

    if not enabled:
        log("未配置 OSS，本次只保留本机副本")
        return 0
    upload_backup(config, path, sha256, "daily")
    state["last_upload_ts"] = int(time.time())
    write_state(config, state)
    # 按“本月是否已存”判断，而不是只看 1 日：1 日失败时下一次成功的备份会补上
    month = time.strftime("%Y-%m")
    if state.get("last_monthly") != month:
        upload_backup(config, path, sha256, "monthly")
        state["last_monthly"] = month
        write_state(config, state)
    return 0


def command_check(config):
    state = read_state(config)
    now = time.time()
    problems = []
    if now - state.get("last_local_ts", 0) > STALE_SECONDS:
        problems.append("超过 26 小时没有新的本机备份")
    try:
        if oss_enabled(config) and now - state.get("last_upload_ts", 0) > STALE_SECONDS:
            problems.append("超过 26 小时没有成功上传 OSS")
    except BackupError as err:
        problems.append(str(err))
    if not problems:
        log("备份状态正常")
        state.pop("last_alert_ts", None)
        write_state(config, state)
        return 0
    # 持续故障时每 6 小时提醒一次，避免每小时刷屏
    if now - state.get("last_alert_ts", 0) >= ALERT_INTERVAL_SECONDS:
        send_alert(config, "；".join(problems))
        state["last_alert_ts"] = int(now)
        write_state(config, state)
    else:
        log("仍有问题（已告警，暂不重复）: %s" % "；".join(problems))
    return 1


def extract_and_inspect(path, tmp_dir, skip_sha=False):
    """校验备份文件并解压，返回解压后的路径和核心表行数。"""
    sidecar = path + ".sha256"
    if os.path.exists(sidecar):
        with open(sidecar, encoding="utf-8") as fh:
            expected = fh.read().split()[0]
        if sha256_file(path) != expected:
            raise BackupError("校验值不一致: %s" % path)
    elif not skip_sha:
        raise BackupError("缺少校验文件 %s（确认后可加 --skip-sha）" % sidecar)
    extracted = os.path.join(tmp_dir, "restore.sqlite")
    try:
        with gzip.open(path, "rb") as src, open(extracted, "wb") as dst:
            shutil.copyfileobj(src, dst)
    except (OSError, EOFError) as err:
        raise BackupError("解压失败: %s" % err)
    return extracted, inspect_database(extracted)


def command_verify(config, args):
    directory = config["BACKUP_LOCAL_DIR"]
    if args.file:
        path = args.file
    else:
        names = sorted(name for name in os.listdir(directory) if FILE_RE.match(name))
        if not names:
            raise BackupError("没有可演练的本机备份")
        path = os.path.join(directory, names[-1])
    with tempfile.TemporaryDirectory(dir=directory, prefix=".verify-") as tmp:
        _, counts = extract_and_inspect(path, tmp)
    state = read_state(config)
    state.update(last_verify_ts=int(time.time()), last_verify_file=os.path.basename(path))
    write_state(config, state)
    log("恢复演练通过 %s，核心表行数 %s" % (os.path.basename(path), counts))
    return 0


def service(config, action):
    command = [config["BACKUP_SYSTEMCTL"], action, config["BACKUP_SERVICE_NAME"]]
    if subprocess.run(command, check=False).returncode != 0:
        raise BackupError("命令失败: %s" % " ".join(command))


def wait_healthy(config, attempts=20, delay=1.5):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(config["BACKUP_HEALTH_URL"], timeout=3) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(delay)
    return False


def put_database(source, db_path, reference_stat):
    tmp = db_path + ".restore-tmp"
    shutil.copyfile(source, tmp)
    os.chmod(tmp, reference_stat.st_mode & 0o777)
    os.chown(tmp, reference_stat.st_uid, reference_stat.st_gid)
    os.replace(tmp, db_path)
    journal = db_path + "-journal"
    if os.path.exists(journal):
        os.remove(journal)


def command_restore(config, args):
    if not args.yes:
        raise BackupError("恢复会替换线上数据库并重启服务，请确认后加 --yes")
    db_path = config["BACKUP_DB_PATH"]
    directory = config["BACKUP_LOCAL_DIR"]
    with tempfile.TemporaryDirectory(dir=directory, prefix=".restore-") as tmp:
        extracted, counts = extract_and_inspect(args.file, tmp, args.skip_sha)
        log("备份校验通过，核心表行数 %s" % counts)
        original_stat = os.stat(db_path)
        keep = os.path.join(directory, "pre-restore-%s.sqlite" % time.strftime("%Y%m%d-%H%M%S"))
        service(config, "stop")
        try:
            shutil.copy2(db_path, keep)
            os.chmod(keep, 0o600)
            log("当前库已保留到 %s" % keep)
            put_database(extracted, db_path, original_stat)
        except OSError as err:
            service(config, "start")
            raise BackupError("替换数据库失败，服务已重新启动: %s" % err)
        service(config, "start")
        if wait_healthy(config):
            log("恢复完成，服务健康检查通过")
            return 0
        log("健康检查未通过，回滚到恢复前的数据库")
        service(config, "stop")
        put_database(keep, db_path, original_stat)
        service(config, "start")
        raise BackupError("恢复后服务不健康，已回滚到 %s" % keep)


def main():
    parser = argparse.ArgumentParser(description="一校教培系统数据库备份工具")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("backup")
    commands.add_parser("check")
    verify = commands.add_parser("verify")
    verify.add_argument("--file", help="要校验的备份文件，默认取本机最新的一份")
    restore = commands.add_parser("restore")
    restore.add_argument("--file", required=True, help="yixiao-db-*.sqlite.gz 备份文件")
    restore.add_argument("--yes", action="store_true", help="确认替换线上数据库")
    restore.add_argument("--skip-sha", action="store_true", help="允许没有 .sha256 文件")
    args = parser.parse_args()

    os.umask(0o077)
    config = load_config()
    directory = config["BACKUP_LOCAL_DIR"]
    os.makedirs(directory, mode=0o700, exist_ok=True)

    with open(os.path.join(directory, ".lock"), "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            # check 每小时跑一次，碰上正在备份属于正常情况
            log("另一个备份任务正在运行，本次跳过")
            return 0 if args.command == "check" else 1
        try:
            if args.command == "backup":
                return command_backup(config)
            if args.command == "check":
                return command_check(config)
            if args.command == "verify":
                return command_verify(config, args)
            return command_restore(config, args)
        except BackupError as err:
            # 人工执行 restore 时错误就在终端上，不需要发群告警
            if args.command == "restore":
                log("失败: %s" % err)
            else:
                send_alert(config, "%s 失败: %s" % (args.command, err))
            return 1
        except Exception as err:  # 未预料的错误同样必须告警，否则备份会悄悄停掉
            if args.command != "restore":
                send_alert(config, "%s 异常: %s: %s" % (args.command, type(err).__name__, err))
            raise


if __name__ == "__main__":
    sys.exit(main())
