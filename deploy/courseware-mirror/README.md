# 课件备份 (盛通课件 → 自有 OSS)

平时课件直接用盛通 (下载) 和百家云 (在线白板) 的公开链接。我们在自有私有 Bucket 的 `courseware/shengtong/` 前缀下备份了部分盛通文件。原平台打不开时，后端改发备份文件的限时签名链接。切换逻辑见 `server/src/modules/curriculum/courseware-source.service.ts`。

## 对象路径规则

`courseware/shengtong/<盛通链接路径>`。路径做 URL 解码，连续的 `/` 合并为一个。例如：

```
https://public-prod-shengtong.oss-cn-zhangjiakou.aliyuncs.com/course/ppt/%E8%A2%8B%E9%BC%A0.pptx
→ courseware/shengtong/course/ppt/袋鼠.pptx
```

后端用同一规则 (`mirrorKeyOf`) 判断某个链接有没有备份。改这里的规则时，后端要一起改。

Bucket 里只有 `photos/` 前缀会被系统批量删除 (`purgeSchedulePhotos`)，`courseware/` 是安全的。

## 清单格式

制表符分隔，第一行是表头：

| 列 | 说明 |
|---|---|
| `oss_key` | 备份对象路径 |
| `原链接` | 盛通链接 |
| `字节` | 文件大小 |
| `sha256` | 本地文件的校验值 |
| `本地路径` | 本地归档里的相对路径，扩展名决定上传时的 Content-Type |

完整清单保存在本地归档的 `_OSS备份清单.tsv`，服务器上另有一份 `/opt/yixiao/courseware-mirror/backup-manifest.tsv`。

## 补传新课件

在 ECS 上运行。脚本读取 `/opt/yixiao/server/.env` 里的 `OSS_*` 配置，走内网上传。

```bash
cd /opt/yixiao/courseware-mirror
nohup nice -n 10 node mirror-courseware.js backup-manifest.tsv 4 > run.log 2>&1 &
node verify-courseware.js backup-manifest.tsv   # 期望 bad=0 extra=0
```

`mirror-courseware.js` 逐个处理清单里的文件：

1. 从盛通下载。
2. 比对 sha256 和清单是否一致；不一致记为 `MISMATCH`，不上传，需从本地归档补传。
3. 上传到 OSS，Content-Type 按 `本地路径` 的扩展名写入。OSS 不允许在签名链接里改写 Content-Type，所以必须在上传时写对。
4. 再核对一次 OSS 上的大小和校验值。

已存在且一致的文件会跳过，所以可以重复运行。结果写在 `mirror-report.tsv`。

## 2026-11-12 首次备份

- 范围：本地 `~/Downloads/课件归档` 的全部课件，共 955 个文件、42.24 GB。
- 逐个核对大小和 sha256，全部一致。
- 有 64 个对象原先没有扩展名，按本地文件改正了 Content-Type。
- 百家云在线白板没有备份。它不可用时，后端改用 Office 在线预览备份的 pptx：后端把带签名、限时有效的文件链接交给微软 Office Online。不想让文件经过微软的服务，可以在后端 `.env` 设置 `COURSEWARE_OFFICE_PREVIEW=off`，老师就只能下载后查看。
