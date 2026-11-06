#!/usr/bin/env python3
"""备份工具的回归测试：全部使用临时目录、临时库和本机假 OSS，不访问任何线上资源。"""
import base64
import gzip
import hashlib
import http.server
import importlib.util
import json
import os
import sqlite3
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "yixiao_db_backup.py")
spec = importlib.util.spec_from_file_location("yixiao_db_backup", SCRIPT)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class FakeServer:
    """记录请求的假 HTTP 服务，同时充当 OSS、告警机器人和健康检查。"""

    def __init__(self):
        outer = self
        self.requests = []
        self.put_status = 200
        self.health_status = 200

        class Handler(http.server.BaseHTTPRequestHandler):
            def _read(self):
                return self.rfile.read(int(self.headers.get("Content-Length") or 0))

            def do_PUT(self):
                body = self._read()
                outer.requests.append(("PUT", self.path, dict(self.headers), body))
                self.send_response(outer.put_status)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def do_POST(self):
                body = self._read()
                outer.requests.append(("POST", self.path, dict(self.headers), body))
                self.send_response(200)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def do_GET(self):
                self.send_response(outer.health_status)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *args):
                pass

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = "http://127.0.0.1:%d" % self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def puts(self):
        return [r for r in self.requests if r[0] == "PUT"]

    def alerts(self):
        return [json.loads(r[3])["text"]["content"] for r in self.requests if r[1] == "/hook"]


def make_db(path, users=3):
    conn = sqlite3.connect(path)
    conn.execute('CREATE TABLE "Company" (id TEXT)')
    conn.execute('CREATE TABLE "User" (id TEXT)')
    conn.execute('CREATE TABLE "Role" (id TEXT)')
    conn.execute('INSERT INTO "Company" VALUES (\'c1\')')
    conn.execute('INSERT INTO "Role" VALUES (\'r1\')')
    for index in range(users):
        conn.execute('INSERT INTO "User" VALUES (?)', ("u%d" % index,))
    conn.commit()
    conn.close()


class BackupTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tmp.name, "dev.db")
        self.dir = os.path.join(self.tmp.name, "backups")
        make_db(self.db)
        self.server = FakeServer()
        self.addCleanup(self.server.close)
        self.addCleanup(self.tmp.cleanup)
        self.env = {
            "PATH": os.environ["PATH"],
            "BACKUP_ENV_FILE": os.path.join(self.tmp.name, "none.env"),
            "BACKUP_DB_PATH": self.db,
            "BACKUP_LOCAL_DIR": self.dir,
            "BACKUP_RETRY_DELAY": "0",
            "ALERT_WEBHOOK_URL": self.server.url + "/hook",
        }

    def enable_oss(self):
        self.env.update(
            BACKUP_OSS_ENDPOINT=self.server.url,
            BACKUP_OSS_BUCKET="bk",
            BACKUP_OSS_ACCESS_KEY_ID="id",
            BACKUP_OSS_ACCESS_KEY_SECRET="secret",
        )

    def run_tool(self, *args):
        return subprocess.run(
            [sys.executable, SCRIPT, *args],
            env=self.env,
            capture_output=True,
            text=True,
            timeout=60,
        )

    def backups(self):
        return sorted(
            name for name in os.listdir(self.dir) if tool.FILE_RE.match(name)
        )

    def state(self):
        with open(os.path.join(self.dir, "state.json"), encoding="utf-8") as fh:
            return json.load(fh)

    def set_state(self, **changes):
        state = self.state() if os.path.exists(os.path.join(self.dir, "state.json")) else {}
        state.update(changes)
        os.makedirs(self.dir, exist_ok=True)
        with open(os.path.join(self.dir, "state.json"), "w", encoding="utf-8") as fh:
            json.dump(state, fh)


class SignatureTest(unittest.TestCase):
    def test_matches_aliyun_documented_example(self):
        signature = tool.oss_signature(
            "OtxrzxIsfpFjA7SwPzILwy8Bw21TLhquhboDYROV",
            "PUT",
            "ODBGOERFMDMzQTczRUY3NUE3NzA5QzdFNUYzMDQxNEM=",
            "text/html",
            "Thu, 17 Nov 2005 18:49:58 GMT",
            {"X-OSS-Meta-Author": "foo@bar.com", "X-OSS-Magic": "abracadabra"},
            "/oss-example/nelson",
        )
        self.assertEqual(signature, "26NBxoKdsyly4EDv6inkoDft/yA=")


class BackupCommandTest(BackupTestCase):
    def test_local_only_without_oss(self):
        result = self.run_tool("backup")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        names = self.backups()
        self.assertEqual(len(names), 1)
        self.assertEqual(self.server.puts(), [])
        path = os.path.join(self.dir, names[0])
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(os.stat(self.dir).st_mode), 0o700)
        extracted = os.path.join(self.tmp.name, "out.sqlite")
        with gzip.open(path) as src, open(extracted, "wb") as dst:
            dst.write(src.read())
        self.assertEqual(tool.inspect_database(extracted)["User"], 3)

    def test_uploads_daily_and_first_monthly_with_required_headers(self):
        self.enable_oss()
        result = self.run_tool("backup")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        puts = self.server.puts()
        paths = [p[1] for p in puts]
        self.assertEqual(len(paths), 4)
        self.assertEqual(sum(p.startswith("/daily/") for p in paths), 2)
        self.assertEqual(sum(p.startswith("/monthly/") for p in paths), 2)
        for _, _, headers, body in puts:
            lowered = {k.lower(): v for k, v in headers.items()}
            self.assertEqual(lowered["x-oss-server-side-encryption"], "AES256")
            self.assertEqual(lowered["x-oss-forbid-overwrite"], "true")
            self.assertTrue(lowered["authorization"].startswith("OSS id:"))
            self.assertEqual(
                lowered["content-md5"],
                base64.b64encode(hashlib.md5(body).digest()).decode(),
            )
        self.assertEqual(self.server.alerts(), [])

    def test_monthly_uploaded_once_per_month_and_retried_next_run(self):
        self.enable_oss()
        self.assertEqual(self.run_tool("backup").returncode, 0)
        self.server.requests.clear()
        time.sleep(1.1)  # 文件名精确到秒
        self.assertEqual(self.run_tool("backup").returncode, 0)
        self.assertTrue(all(p[1].startswith("/daily/") for p in self.server.puts()))

        self.set_state(last_monthly="2000-01")
        self.server.requests.clear()
        time.sleep(1.1)
        self.assertEqual(self.run_tool("backup").returncode, 0)
        self.assertEqual(sum(p[1].startswith("/monthly/") for p in self.server.puts()), 2)

    def test_upload_failure_alerts_and_keeps_local_copy(self):
        self.enable_oss()
        self.server.put_status = 403
        result = self.run_tool("backup")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(self.backups()), 1)
        alerts = self.server.alerts()
        self.assertEqual(len(alerts), 1)
        self.assertIn("备份", alerts[0])
        self.assertIn("403", alerts[0])
        self.assertNotIn("last_upload_ts", self.state())
        self.assertNotIn("last_monthly", self.state())

    def test_partial_oss_config_fails_before_doing_anything(self):
        self.env["BACKUP_OSS_BUCKET"] = "bk"
        result = self.run_tool("backup")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.backups(), [])
        self.assertIn("OSS 配置不完整", self.server.alerts()[0])

    def test_empty_core_table_rejected_and_old_backups_kept(self):
        self.assertEqual(self.run_tool("backup").returncode, 0)
        before = self.backups()
        conn = sqlite3.connect(self.db)
        conn.execute('DELETE FROM "User"')
        conn.commit()
        conn.close()
        time.sleep(1.1)
        result = self.run_tool("backup")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.backups(), before)
        self.assertIn("核心表 User 为空", self.server.alerts()[0])

    def test_corrupt_database_alerts(self):
        with open(self.db, "r+b") as fh:
            fh.seek(0)
            fh.write(b"not a sqlite database at all....")
        result = self.run_tool("backup")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.backups(), [])
        self.assertEqual(len(self.server.alerts()), 1)

    def test_missing_database_alerts(self):
        os.remove(self.db)
        self.assertEqual(self.run_tool("backup").returncode, 1)
        self.assertEqual(len(self.server.alerts()), 1)

    def test_keeps_only_seven_local_backups(self):
        os.makedirs(self.dir, exist_ok=True)
        unrelated = os.path.join(self.dir, "pre-restore-20200101-000000.sqlite")
        open(unrelated, "w").close()
        for day in range(1, 10):
            name = "yixiao-db-202001%02d-000000.sqlite.gz" % day
            for suffix in ("", ".sha256"):
                open(os.path.join(self.dir, name + suffix), "w").close()
        self.assertEqual(self.run_tool("backup").returncode, 0)
        names = self.backups()
        self.assertEqual(len(names), 7)
        self.assertNotIn("yixiao-db-20200103-000000.sqlite.gz", names)
        self.assertFalse(
            os.path.exists(os.path.join(self.dir, "yixiao-db-20200101-000000.sqlite.gz.sha256"))
        )
        self.assertTrue(os.path.exists(unrelated))

    def test_snapshot_is_consistent_during_concurrent_writes(self):
        conn = sqlite3.connect(self.db)
        conn.execute('CREATE TABLE "Pair" (a INTEGER, b INTEGER)')
        conn.execute('INSERT INTO "Pair" VALUES (0, 0)')
        conn.executemany(
            'INSERT INTO "User" VALUES (?)', (("x" * 500,) for _ in range(5000))
        )
        conn.commit()
        conn.close()
        stop = threading.Event()

        def writer():
            db = sqlite3.connect(self.db, timeout=30)
            value = 0
            while not stop.is_set():
                value += 1
                db.execute('UPDATE "Pair" SET a=?', (value,))
                db.execute('UPDATE "Pair" SET b=?', (value,))
                db.commit()
            db.close()

        thread = threading.Thread(target=writer)
        thread.start()
        try:
            for attempt in range(3):
                self.assertEqual(self.run_tool("backup").returncode, 0)
                time.sleep(1.1)
        finally:
            stop.set()
            thread.join()
        for name in self.backups():
            extracted = os.path.join(self.tmp.name, name + ".out")
            with gzip.open(os.path.join(self.dir, name)) as src, open(extracted, "wb") as dst:
                dst.write(src.read())
            check = sqlite3.connect(extracted)
            a, b = check.execute('SELECT a, b FROM "Pair"').fetchone()
            check.close()
            self.assertEqual(a, b)


class CheckCommandTest(BackupTestCase):
    def test_fresh_backup_is_ok(self):
        self.assertEqual(self.run_tool("backup").returncode, 0)
        self.assertEqual(self.run_tool("check").returncode, 0)
        self.assertEqual(self.server.alerts(), [])

    def test_never_backed_up_alerts(self):
        self.assertEqual(self.run_tool("check").returncode, 1)
        self.assertEqual(len(self.server.alerts()), 1)

    def test_stale_alerts_once_within_interval_then_again(self):
        self.set_state(last_local_ts=int(time.time()) - 27 * 3600)
        self.assertEqual(self.run_tool("check").returncode, 1)
        self.assertEqual(self.run_tool("check").returncode, 1)
        self.assertEqual(len(self.server.alerts()), 1)
        self.set_state(last_alert_ts=int(time.time()) - 7 * 3600)
        self.assertEqual(self.run_tool("check").returncode, 1)
        self.assertEqual(len(self.server.alerts()), 2)

    def test_stale_upload_alerts_even_when_local_is_fresh(self):
        self.enable_oss()
        now = int(time.time())
        self.set_state(last_local_ts=now, last_upload_ts=now - 27 * 3600)
        self.assertEqual(self.run_tool("check").returncode, 1)
        self.assertIn("OSS", self.server.alerts()[0])


class VerifyCommandTest(BackupTestCase):
    def test_passes_without_touching_live_database(self):
        self.assertEqual(self.run_tool("backup").returncode, 0)
        before = tool.sha256_file(self.db)
        self.assertEqual(self.run_tool("verify").returncode, 0)
        self.assertEqual(tool.sha256_file(self.db), before)
        self.assertIn("last_verify_ts", self.state())

    def test_verifies_a_specified_downloaded_file(self):
        self.assertEqual(self.run_tool("backup").returncode, 0)
        name = self.backups()[-1]
        downloaded = os.path.join(self.tmp.name, name)
        for suffix in ("", ".sha256"):
            with open(os.path.join(self.dir, name + suffix), "rb") as src:
                with open(downloaded + suffix, "wb") as dst:
                    dst.write(src.read())
        self.assertEqual(self.run_tool("verify", "--file", downloaded).returncode, 0)
        with open(downloaded, "ab") as fh:
            fh.write(b"x")
        self.assertEqual(self.run_tool("verify", "--file", downloaded).returncode, 1)

    def test_detects_tampered_backup(self):
        self.assertEqual(self.run_tool("backup").returncode, 0)
        with open(os.path.join(self.dir, self.backups()[-1]), "ab") as fh:
            fh.write(b"x")
        self.assertEqual(self.run_tool("verify").returncode, 1)
        self.assertIn("校验值不一致", self.server.alerts()[0])

    def test_no_backup_alerts(self):
        self.assertEqual(self.run_tool("verify").returncode, 1)
        self.assertEqual(len(self.server.alerts()), 1)


class RestoreCommandTest(BackupTestCase):
    def setUp(self):
        super().setUp()
        self.calls = os.path.join(self.tmp.name, "calls.log")
        fake = os.path.join(self.tmp.name, "fake-systemctl")
        with open(fake, "w") as fh:
            fh.write('#!/bin/sh\necho "$1 $2" >> "%s"\n' % self.calls)
        os.chmod(fake, 0o755)
        self.env.update(
            BACKUP_SYSTEMCTL=fake,
            BACKUP_SERVICE_NAME="svc",
            BACKUP_HEALTH_URL=self.server.url + "/health",
        )
        self.assertEqual(self.run_tool("backup").returncode, 0)
        self.file = os.path.join(self.dir, self.backups()[-1])
        conn = sqlite3.connect(self.db)
        conn.execute('INSERT INTO "User" VALUES (\'after-backup\')')
        conn.commit()
        conn.close()

    def user_count(self):
        conn = sqlite3.connect(self.db)
        count = conn.execute('SELECT COUNT(*) FROM "User"').fetchone()[0]
        conn.close()
        return count

    def service_calls(self):
        if not os.path.exists(self.calls):
            return []
        with open(self.calls) as fh:
            return fh.read().splitlines()

    def test_requires_yes(self):
        result = self.run_tool("restore", "--file", self.file)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.user_count(), 4)
        self.assertEqual(self.service_calls(), [])

    def test_restores_and_keeps_previous_database(self):
        mode = 0o640
        os.chmod(self.db, mode)
        result = self.run_tool("restore", "--file", self.file, "--yes")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.user_count(), 3)
        self.assertEqual(self.service_calls(), ["stop svc", "start svc"])
        self.assertEqual(stat.S_IMODE(os.stat(self.db).st_mode), mode)
        kept = [n for n in os.listdir(self.dir) if n.startswith("pre-restore-")]
        self.assertEqual(len(kept), 1)
        conn = sqlite3.connect(os.path.join(self.dir, kept[0]))
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM "User"').fetchone()[0], 4)
        conn.close()

    def test_rejects_tampered_file_without_stopping_service(self):
        with open(self.file, "ab") as fh:
            fh.write(b"x")
        result = self.run_tool("restore", "--file", self.file, "--yes")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.service_calls(), [])
        self.assertEqual(self.user_count(), 4)
        self.assertEqual(self.server.alerts(), [])

    def test_missing_sha_needs_explicit_skip(self):
        os.remove(self.file + ".sha256")
        self.assertEqual(self.run_tool("restore", "--file", self.file, "--yes").returncode, 1)
        self.assertEqual(self.user_count(), 4)
        result = self.run_tool("restore", "--file", self.file, "--yes", "--skip-sha")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.user_count(), 3)

    def test_rolls_back_when_service_unhealthy(self):
        # 直接调用函数以跳过健康检查的等待时间
        self.addCleanup(setattr, tool, "wait_healthy", tool.wait_healthy)
        tool.wait_healthy = lambda cfg: False
        saved_env = dict(os.environ)
        self.addCleanup(lambda: (os.environ.clear(), os.environ.update(saved_env)))
        os.environ.update(self.env)

        class Args:
            file = self.file
            yes = True
            skip_sha = False

        with self.assertRaises(tool.BackupError):
            tool.command_restore(tool.load_config(), Args)
        self.assertEqual(self.user_count(), 4)
        self.assertEqual(
            self.service_calls(), ["stop svc", "start svc", "stop svc", "start svc"]
        )


if __name__ == "__main__":
    unittest.main(verbosity=1)
