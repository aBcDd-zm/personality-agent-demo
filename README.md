# 情景化大五人格语料采集小程序 V0.6

这是一个情景化大五人格语料采集小程序，用于收集「BFI-2-S 30 题问卷分数 + 连续职场情境开放回答文本」的 H5 + FastAPI 原型。FastAPI 后端同时托管前端静态页面和 `/api` 接口，数据继续保存到服务器本地 SQLite 文件 `data/personality_demo.db`。

当前版本处于语料采集阶段，不接真实 LLM，不调用 DeepSeek 或其他 LLM API，也不需要 API Key。本轮部署整理不接 MySQL、MongoDB、PostgreSQL 等外部数据库服务。

当前公网版本已部署在 `http://139.196.23.47/`。结果页已支持真实二维码邀请和完整结果海报保存：用户完成测评后看到自己的结果；二维码内容为首页入口 `/?ref=当前participantId`，别人扫码后从首页重新测评，不能看到分享者结果；移动端顶部主海报会自动替换成完整 PNG 图片，长按即可保存，PNG 内包含人格卡、人格名称、标签、大五人格雷达图、底部邀请文案和真实可扫码二维码。

## 目录结构

```text
personality-agent-demo-v06/
├── backend/
│   └── main.py              # FastAPI 后端 + SQLite + 静态页面托管
├── frontend/
│   ├── index.html           # H5 页面
│   ├── styles.css           # 页面样式
│   └── app.js               # 前端逻辑
├── data/
│   └── .gitkeep             # 启动后自动生成 personality_demo.db
├── docs/
│   └── data_schema.md       # CSV 字段和计分说明
├── .gitignore               # Git 忽略本地运行环境、数据库、导出文件和缓存
├── requirements.txt
├── DEPLOYMENT.md
├── SERVER_HANDOFF.md
└── README.md
```

正式部署包不包含 `.venv/`、`__MACOSX/`、`__pycache__/` 或旧的 `data/personality_demo.db` 测试库。首次启动后，后端会自动创建新的空数据库。

## 技术栈

- 后端：FastAPI
- 前端：静态前端，原生 HTML / CSS / JavaScript
- 数据保存：SQLite 本地文件 `data/personality_demo.db`
- 运行依赖：Python 3.10+，推荐 Python 3.11 或 3.12
- 不需要 npm、Node、Vite、`npm install`、`npm run build` 或 `npm run preview`
- 不需要 `.env`、API Key 或任何真实 LLM 服务

## 启动方式

```bash
cd personality-agent-demo-v06
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

浏览器访问：

```text
http://服务器IP:8000
```

当前公网地址：

```text
http://139.196.23.47/
```

本机测试也可以访问：

```text
http://127.0.0.1:8000
```

自动 API 文档：

```text
http://服务器IP:8000/docs
```

CSV 导出：

```text
http://服务器IP:8000/api/export/csv
```

本机测试时也可以访问：

```text
http://127.0.0.1:8000/api/export/csv
```

## 页面流程

```text
知情同意
→ 基本信息
→ BFI-2-S 30 题问卷
→ 连续职场情境 6 轮问答
→ 结果页
→ 顶部完整海报 PNG / 二维码邀请别人重新测评
→ 导出 CSV
```

## 结果页、二维码和完整海报保存

- 用户完成测评后只看到自己的结果页。
- 结果页二维码内容为首页入口：`/?ref=当前participantId`。
- 被邀请者扫码后进入首页重新测评，点击开始会生成新的 `participant_id`。
- 项目不使用旧的 `/share/{participant_id}` 分享结果页方案，别人不能看到分享者结果。
- 移动端进入结果页后，顶部主海报区域会自动替换成 canvas 导出的完整 PNG 图片。
- 手机端保存方式：直接长按顶部完整海报图片并选择保存图片。
- 电脑端仍保留“保存结果海报”和“下载海报 PNG”入口。
- 最终 PNG 尺寸为 `1080 x 1880`，包含人格卡、人格名称、标签、说明、大五人格雷达图、底部邀请文案和二维码。
- 二维码、人格卡、雷达图和文字都绘制进最终 canvas，不依赖 DOM 覆盖层。

## 数据保存

- 每次点击开始会生成唯一 `participant_id`。
- 基本信息写入 `sessions`。
- BFI-2-S 问卷答案和五维分数写入 `bfi_results`。
- 情境问答写入 `task_responses`。
- 不同 `participant_id` 的数据不会互相覆盖。
- 同一 `participant_id + task_id` 重复提交时会更新该轮记录，避免同一次填写内重复点击产生重复行。
- CSV 当前导出范围是：已提交 BFI 问卷，并且至少提交过一轮情境任务的数据。只填了问卷但没有提交情境问答的用户，不会出现在当前 CSV 中。

SQLite 连接已设置 `timeout=30`、`busy_timeout=30000` 和 WAL 模式，用于降低多人同时提交时出现 `database is locked` 的概率。SQLite 仍然适合作为本阶段轻量采集的本地文件方案；如果后续采集规模明显增大，再另行评估外部数据库服务。

## 主要数据字段

CSV 每一行代表一个用户在一个情境任务下的一条语料记录。主要字段包括：

- `participant_id`：随机生成的被试 ID。
- `age_group`、`gender`、`education`：基础信息字段，均为可选字段。
- `bfi_version`：问卷版本，本版本为 `BFI-2-S`。
- `bfi_q1` - `bfi_q30`：BFI-2-S 30 题原始答案。
- `bfi_E`、`bfi_A`、`bfi_C`、`bfi_N`、`bfi_O`：五个大五人格维度分数。
- `facet_*`：15 个 BFI-2-S facet 子维度分数，作为辅助分析字段。
- `task_id`、`task_name`、`target_traits`、`main_prompt`、`followup_prompt`：情境任务信息。
- `user_answer_1`、`user_answer_2`、`full_text`：用户开放回答文本及合并文本。
- `char_count`、`word_count`、`quality_flag`、`created_at`：文本长度、质量标记和提交时间。

完整字段和计分规则见 `docs/data_schema.md`。

## BFI-2-S 和情境任务

本项目使用 BFI-2-S 30 题作为问卷标签，输出五个核心维度：

| 字段 | 说明 |
|---|---|
| bfi_E | 外向性 |
| bfi_A | 宜人性 |
| bfi_C | 尽责性 |
| bfi_N | 神经质/负性情绪 |
| bfi_O | 开放性/开放心智 |

系统保留 15 个 facet 子维度分数作为辅助分析字段。详细字段、计分规则和 CSV 说明见 `docs/data_schema.md`。

6 轮连续职场情境用于收集用户在表达、合作、冲突、压力、责任、变化和边界感中的开放回答。前端不展示 `target_traits`，避免被试根据人格维度标签调整回答；该字段仍会保存并导出，便于后续研究分析。

## 部署说明

详细部署步骤、Nginx 反向代理、后台运行、数据库备份和清空测试数据方法见 `DEPLOYMENT.md`。

服务器交接清单见 `SERVER_HANDOFF.md`。

## 隐私注意事项

本项目只用于采集人格问卷分数和情境化开放回答文本。采集和测试时不要要求或诱导用户填写真实姓名、手机号、住址、身份证号、邮箱、精确单位/学校等可识别个人身份的信息。若用户在开放回答中主动填写了隐私信息，建议在导出分析前先做人工清理或脱敏处理。
