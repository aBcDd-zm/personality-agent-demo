# personality-agent-demo-v06 服务器交接清单

请服务器同学在部署前确认并提供以下信息。当前公网环境已部署一版可运行服务，下面同时记录现有环境，后续迁移或重新部署时可作为对照。

## 服务器信息

| 项目 | 内容 |
|---|---|
| 公网 IP | `139.196.23.47` |
| 操作系统版本 |  |
| CPU / 内存 |  |
| 部署目录 | `/opt/personality-agent-demo-v06` |
| 负责人 |  |

## SSH 登录

| 项目 | 内容 |
|---|---|
| SSH 用户名 | `root` |
| SSH 端口 |  |
| 登录方式 | 密码 / 密钥 |
| 密钥文件或跳板机说明 |  |
| 是否需要 sudo 权限 | 当前使用 root 登录 |

## Python 环境

| 项目 | 内容 |
|---|---|
| 是否已安装 Python 3 | 是 / 否 |
| Python 版本 |  |
| 是否已安装 pip | 是 / 否 |
| 是否允许创建 `.venv` | 是 / 否 |

推荐 Python 3.10+，优先使用 Python 3.11 或 3.12。

## 端口和访问

| 项目 | 内容 |
|---|---|
| 是否直接开放 8000 端口 | 是 / 否 |
| 是否使用 Nginx | 当前公网通过 `http://139.196.23.47/` 访问，FastAPI 服务监听 `127.0.0.1:8000` |
| 如使用 Nginx，是否开放 80 | 是 / 否 |
| 如使用 HTTPS，是否开放 443 | 是 / 否 |
| 是否需要域名 | 是 / 否 |
| 域名 |  |
| 是否需要 HTTPS 证书 | 是 / 否 |

直接访问时，FastAPI 需要使用：

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

使用 Nginx 时，Nginx 反向代理到 FastAPI `8000` 端口，不需要单独部署前端 `dist`。

当前 systemd 服务：

```text
personality-agent-demo-v06
```

常用检查命令：

```bash
systemctl is-active personality-agent-demo-v06
curl -s -o /tmp/home.html -w "%{http_code} %{size_download}\n" http://127.0.0.1:8000/
grep -n "styles.css?v=0604-6\|app.js?v=0604-6" /tmp/home.html
```

## 数据目录和备份

| 项目 | 内容 |
|---|---|
| `data/` 目录是否允许写入 | 是 / 否 |
| 运行服务的系统用户 |  |
| 数据库文件路径 | `data/personality_demo.db` |
| 数据库备份目录 |  |
| 备份频率 |  |
| 备份负责人 |  |

SQLite 运行时可能出现以下文件，都属于正常数据文件：

```text
data/personality_demo.db
data/personality_demo.db-wal
data/personality_demo.db-shm
```

正式上线前，如果旧库里有测试数据，请先备份再删除旧数据库文件，由服务重启后自动创建空库。

## 部署确认

| 验收项 | 结果 |
|---|---|
| 服务可以启动 |  |
| 首页可以打开 |  |
| 手机浏览器可以打开 |  |
| 电脑浏览器可以打开 |  |
| 问卷可以提交 |  |
| 情景问答可以提交 |  |
| 结果页可以显示用户自己的结果 |  |
| 二维码内容为 `/?ref=当前participantId` |  |
| 扫码后进入首页重新测评，不显示分享者结果 |  |
| 点击开始后生成新的 `participant_id` |  |
| “保存结果海报”可生成完整 PNG |  |
| 手机端长按完整海报图片可保存 |  |
| 保存后的海报包含人格卡、人格名称、邀请文案和二维码 |  |
| 保存后海报中的二维码真实可扫码 |  |
| `data/personality_demo.db` 可以生成 |  |
| `/api/export/csv` 可以下载 |  |
| 重启服务后数据仍保留 |  |
| 已确认备份方案 |  |

## 备注

- 本项目不需要 npm 或 Node 构建。
- 本项目不接 MySQL、MongoDB、PostgreSQL 等外部数据库服务。
- 当前 CSV 只导出已提交 BFI 问卷并提交过至少一轮情景任务的数据。
- 当前结果页不使用 `/share/{participant_id}` 旧分享结果页方案。二维码只用于邀请别人从首页重新测评。
- 当前完整海报保存由前端原生 canvas 生成 PNG，并显示为真实 `img#resultPosterImg`；二维码已绘制进最终 PNG。
