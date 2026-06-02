# 数据字段说明 V0.6

CSV 每一行代表一个用户在一个情境任务下的一条语料记录。

| 字段 | 说明 |
|---|---|
| participant_id | 随机被试 ID |
| age_group | 年龄段，可选 |
| gender | 性别，可选 |
| education | 年级/学历，可选 |
| bfi_version | 问卷版本，本版本为 BFI-2-S |
| bfi_q1 - bfi_q30 | BFI-2-S 30 题原始答案 |
| bfi_E | 外向性问卷分，1-5 |
| bfi_A | 宜人性问卷分，1-5 |
| bfi_C | 尽责性问卷分，1-5 |
| bfi_N | 神经质问卷分，1-5 |
| bfi_O | 开放性问卷分，1-5 |
| task_id | 情境任务编号 |
| task_name | 情境任务名称 |
| target_traits | 任务主要观测维度 |
> V0.6 说明：`target_traits` 仍作为研究字段保存和导出，但前端页面不展示该字段，以避免被试根据人格维度标签调整回答。

| main_prompt | 主情境问题 |
| user_answer_1 | 用户第一轮开放回答 |
| followup_prompt | 固定追问 |
| user_answer_2 | 用户第二轮开放回答 |
| full_text | 合并后的完整文本 |
| char_count | 中文字符数/非空字符数 |
| word_count | 空格分词后的词数，中文仅作参考 |
| created_at | 提交时间 |

## BFI-2-S 维度命名说明

BFI-2-S 仍然测量大五人格的五个核心维度，但它属于 BFI-2 体系，因此维度命名与传统 Big Five / BFI-10 有两处差异：

| 传统 Big Five / BFI-10 写法 | BFI-2 体系写法 | 本项目 CSV 字段 |
|---|---|---|
| Extraversion 外向性 | Extraversion 外向性 | bfi_E |
| Agreeableness 宜人性 | Agreeableness 宜人性 | bfi_A |
| Conscientiousness 尽责性 | Conscientiousness 尽责性 | bfi_C |
| Neuroticism 神经质 | Negative Emotionality 负性情绪 | bfi_N |
| Openness 开放性 | Open-Mindedness 开放心智 | bfi_O |

为了与前期 BFI-10 版本、模型训练字段和 CSV 字段保持一致，本项目继续使用 `bfi_N` 表示神经质/负性情绪，使用 `bfi_O` 表示开放性/开放心智。

## BFI-2-S 计分

本版本使用 BFI-2-S 30 题作为问卷标签。每道题使用 1-5 分：

- 1 = 非常不同意
- 2 = 比较不同意
- 3 = 一般/不确定
- 4 = 比较同意
- 5 = 非常同意

反向题使用：`6 - 原始分`。

| 维度 | 计算方式 |
|---|---|
| E 外向性 | `(reverse(q1) + q6 + q11 + q16 + reverse(q21) + reverse(q26)) / 6` |
| A 宜人性 | `(q2 + reverse(q7) + q12 + reverse(q17) + q22 + reverse(q27)) / 6` |
| C 尽责性 | `(reverse(q3) + reverse(q8) + q13 + q18 + q23 + reverse(q28)) / 6` |
| N 神经质 | `(q4 + q9 + reverse(q14) + reverse(q19) + reverse(q24) + q29) / 6` |
| O 开放性 | `(q5 + reverse(q10) + q15 + reverse(q20) + q25 + reverse(q30)) / 6` |

## BFI-2-S 反向计分题分布

| 维度 | 反向计分题 |
|---|---|
| E 外向性 | q1, q21, q26 |
| A 宜人性 | q7, q17, q27 |
| C 尽责性 | q3, q8, q28 |
| N 神经质/负性情绪 | q14, q19, q24 |
| O 开放性 | q10, q20, q30 |

## BFI-2-S Facet 子维度说明

BFI-2-S 除了五个大维度外，还保留了 15 个 facet 子维度。每个大维度包含 3 个 facet，每个 facet 由 2 道题计算得到。

| Facet 字段建议 | 中文名称 | 所属大维度 | 计算方式 |
|---|---|---|---|
| facet_E_sociability | 社交性 | E 外向性 | `(reverse(q1) + q16) / 2` |
| facet_E_assertiveness | 果断性 | E 外向性 | `(q6 + reverse(q21)) / 2` |
| facet_E_energy | 活力水平 | E 外向性 | `(q11 + reverse(q26)) / 2` |
| facet_A_compassion | 同情心 | A 宜人性 | `(q2 + reverse(q17)) / 2` |
| facet_A_respectfulness | 尊重性 | A 宜人性 | `(reverse(q7) + q22) / 2` |
| facet_A_trust | 信任 | A 宜人性 | `(q12 + reverse(q27)) / 2` |
| facet_C_organization | 条理性 | C 尽责性 | `(reverse(q3) + q18) / 2` |
| facet_C_productiveness | 效率性 | C 尽责性 | `(reverse(q8) + q23) / 2` |
| facet_C_responsibility | 责任感 | C 尽责性 | `(q13 + reverse(q28)) / 2` |
| facet_N_anxiety | 焦虑 | N 神经质/负性情绪 | `(q4 + reverse(q19)) / 2` |
| facet_N_depression | 低落 | N 神经质/负性情绪 | `(q9 + reverse(q24)) / 2` |
| facet_N_emotional_volatility | 情绪波动 | N 神经质/负性情绪 | `(reverse(q14) + q29) / 2` |
| facet_O_aesthetic_sensitivity | 审美敏感性 | O 开放性/开放心智 | `(q5 + reverse(q20)) / 2` |
| facet_O_intellectual_curiosity | 智识好奇心 | O 开放性/开放心智 | `(reverse(q10) + q25) / 2` |
| facet_O_creative_imagination | 创造想象力 | O 开放性/开放心智 | `(q15 + reverse(q30)) / 2` |

当前版本的核心分析仍然以五个大维度 `bfi_E / bfi_A / bfi_C / bfi_N / bfi_O` 为主。Facet 分数可以作为后续辅助分析字段，例如观察情境文本更接近外向性的“社交性”还是“果断性”，但不建议在样本量较小时过度解释 facet 结果。

## V0.6 任务设计

情境任务已经统一改为职场场景，用于激活大五人格相关表达。`target_traits` 使用中文维度名 + 英文缩写，便于人工检查和后续模型实验。

- 进入晨会：外向性 E / 开放性 O
- 同事提出不同意见：宜人性 A / 开放性 O
- 会议中发现数据错误：尽责性 C / 神经质 N
- 被负责人指出问题：神经质 N / 宜人性 A
- 老板临时增加新需求：尽责性 C / 开放性 O
- 下班前同事请求帮助：宜人性 A / 尽责性 C

## V0.6 前端体验说明

V0.6 延续问卷作答页的悬浮进度和 1-5 分含义提示，不改变任何 CSV 字段、问卷计分公式或情境任务数据结构。问卷阶段的完成进度和 1-5 分含义会以悬浮条形式跟随页面滚动，方便被试在作答后半段仍能看到当前完成情况和评分含义。
