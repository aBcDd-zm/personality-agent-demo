# personality-agent-demo-v06 部署说明

## 项目类型

本项目是 FastAPI + 静态前端 + SQLite：

- FastAPI 后端入口：`backend/main.py`
- 前端文件目录：`frontend/`
- FastAPI 同时托管首页、静态资源和 `/api` 接口
- SQLite 数据库文件：`data/personality_demo.db`
- 不需要 npm、Node、Vite、`npm install`、`npm run build` 或 `npm run preview`

本轮不接 MySQL、MongoDB、PostgreSQL 等外部数据库服务，继续使用现有 SQLite 本地文件保存数据。

## 环境要求

- Python：建议 Python 3.10+，推荐 Python 3.11 或 3.12
- pip：随 Python 安装
- 操作系统：Linux 服务器优先，macOS 本地测试也可
- 端口：直接访问时开放 `8000`；使用 Nginx 时开放 `80/443`

## 本地启动

```bash
cd personality-agent-demo-v06
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

本机浏览器访问：

```text
http://127.0.0.1:8000
```

## 服务器最小启动方式

```bash
cd personality-agent-demo-v06
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

公网访问：

```text
http://服务器IP:8000
```

如果无法访问，先确认云服务器安全组、防火墙和系统防火墙都已开放 `8000` 端口。

## 常用地址

| 用途 | 地址 |
|---|---|
| 首页 | `http://服务器IP:8000/` |
| API 文档 | `http://服务器IP:8000/docs` |
| CSV 导出 | `http://服务器IP:8000/api/export/csv` |

CSV 当前导出范围是：已经提交 BFI 问卷，并且至少提交过一轮情景任务的数据。只填了问卷但没有提交情景问答的用户，不会出现在当前 CSV 中。

## 数据库文件

数据库路径：

```text
data/personality_demo.db
```

正式部署包不包含旧测试数据库。首次启动后，FastAPI 会自动创建新的空数据库。

SQLite 已启用：

- `timeout=30`
- `PRAGMA busy_timeout = 30000`
- `PRAGMA journal_mode = WAL`

WAL 模式运行时可能同时出现：

```text
data/personality_demo.db
data/personality_demo.db-wal
data/personality_demo.db-shm
```

这是正常现象。

## 备份数据库

建议先停止服务，再备份数据库及 WAL 相关文件：

```bash
mkdir -p backups
cp data/personality_demo.db backups/personality_demo_$(date +%Y%m%d_%H%M%S).db
cp data/personality_demo.db-wal backups/ 2>/dev/null || true
cp data/personality_demo.db-shm backups/ 2>/dev/null || true
```

如果服务必须继续运行，建议至少确认导出 CSV 可用，并在低流量时段执行备份。

## 清空测试数据

正式上线前如果需要清空测试数据：

```bash
# 1. 先停止 uvicorn / nohup / systemd / pm2 服务

# 2. 可选：先备份旧库
mkdir -p backups
cp data/personality_demo.db backups/personality_demo_before_clear_$(date +%Y%m%d_%H%M%S).db 2>/dev/null || true

# 3. 删除旧数据库和 WAL 文件
rm -f data/personality_demo.db data/personality_demo.db-wal data/personality_demo.db-shm

# 4. 重新启动服务，系统会自动创建空库
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## nohup 后台启动

```bash
cd personality-agent-demo-v06
source .venv/bin/activate
nohup uvicorn backend.main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
```

查看日志：

```bash
tail -f app.log
```

停止服务：

```bash
ps aux | grep uvicorn
kill <PID>
```

## systemd 启动

示例服务文件：`/etc/systemd/system/personality-agent-demo-v06.service`

```ini
[Unit]
Description=personality-agent-demo-v06 FastAPI service
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/personality-agent-demo-v06
ExecStart=/path/to/personality-agent-demo-v06/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable personality-agent-demo-v06
sudo systemctl start personality-agent-demo-v06
sudo systemctl status personality-agent-demo-v06
```

如果不用 Nginx，`ExecStart` 可以改为 `--host 0.0.0.0 --port 8000`，并开放 `8000` 端口。

## PM2 启动

PM2 可用于托管 Python 进程，但不是必须。

```bash
cd personality-agent-demo-v06
source .venv/bin/activate
pm2 start .venv/bin/uvicorn --name personality-agent-demo-v06 --interpreter none -- backend.main:app --host 0.0.0.0 --port 8000
pm2 save
```

查看日志：

```bash
pm2 logs personality-agent-demo-v06
```

停止：

```bash
pm2 stop personality-agent-demo-v06
```

## Nginx 反向代理

Nginx 只做反向代理到 FastAPI `8000` 端口，不需要单独部署前端 `dist`。

后端建议绑定本机：

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Nginx 示例：

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用后检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

公网访问：

```text
http://example.com/
```

如果需要 HTTPS，请由服务器同学配置域名解析和证书，例如使用 Certbot。

## 常见问题

### 服务器 IP:8000 打不开

- 确认 uvicorn 使用 `--host 0.0.0.0`
- 确认云服务器安全组开放 `8000`
- 确认系统防火墙开放 `8000`
- 确认服务正在运行：`ps aux | grep uvicorn`

### Nginx 访问失败

- 确认 FastAPI 在 `127.0.0.1:8000` 正常运行
- 检查 Nginx 配置：`sudo nginx -t`
- 查看 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`

### 数据没有写入

- 确认 `data/` 目录存在
- 确认运行服务的用户对 `data/` 有写权限
- 查看服务日志是否出现 `database is locked` 或权限错误

### CSV 为空

- 确认用户已经提交 BFI 问卷
- 确认用户至少提交过一轮情景任务
- 当前 CSV 不导出只填问卷但没有提交情景问答的用户

### pip 安装依赖时出现 SSL 证书错误

- 优先修复服务器系统证书，例如更新 `ca-certificates`
- 确认服务器时间正确
- 临时排查时可让服务器同学检查 Python/pip 的证书配置和镜像源
- 不建议长期关闭证书校验；本地验证如需临时绕过，可使用可信内网源或服务器认可的 PyPI 镜像

### 想重新开始正式采集

- 停止服务
- 备份旧 `data/personality_demo.db`
- 删除 `data/personality_demo.db`、`data/personality_demo.db-wal`、`data/personality_demo.db-shm`
- 重启服务，系统自动创建空库
