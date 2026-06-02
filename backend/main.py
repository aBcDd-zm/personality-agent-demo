from __future__ import annotations

import csv
import io
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "personality_demo.db"
FRONTEND_DIR = ROOT_DIR / "frontend"

DATA_DIR.mkdir(exist_ok=True)

BFI_VERSION = "BFI-2-S"

app = FastAPI(title="情景化大五人格语料采集小程序 V0.6", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BFI_QUESTIONS: list[dict[str, Any]] = [
    # E 外向性
    {
        "id": "q1",
        "text": "我认为自己比较安静，不太爱说话。",
        "trait": "E",
        "trait_name": "外向性",
        "facet": "Sociability",
        "facet_name": "社交性",
        "reverse": True,
    },
    {
        "id": "q6",
        "text": "我认为自己有主导性，像一个领导者。",
        "trait": "E",
        "trait_name": "外向性",
        "facet": "Assertiveness",
        "facet_name": "果断性",
        "reverse": False,
    },
    {
        "id": "q11",
        "text": "我认为自己精力充沛，做事有活力。",
        "trait": "E",
        "trait_name": "外向性",
        "facet": "Energy Level",
        "facet_name": "活力水平",
        "reverse": False,
    },
    {
        "id": "q16",
        "text": "我认为自己外向、善于交际。",
        "trait": "E",
        "trait_name": "外向性",
        "facet": "Sociability",
        "facet_name": "社交性",
        "reverse": False,
    },
    {
        "id": "q21",
        "text": "我更愿意让别人负责和带领。",
        "trait": "E",
        "trait_name": "外向性",
        "facet": "Assertiveness",
        "facet_name": "果断性",
        "reverse": True,
    },
    {
        "id": "q26",
        "text": "我认为自己活跃度较低，行动不太积极。",
        "trait": "E",
        "trait_name": "外向性",
        "facet": "Energy Level",
        "facet_name": "活力水平",
        "reverse": True,
    },

    # A 宜人性
    {
        "id": "q2",
        "text": "我认为自己有同情心，容易关心别人。",
        "trait": "A",
        "trait_name": "宜人性",
        "facet": "Compassion",
        "facet_name": "同情心",
        "reverse": False,
    },
    {
        "id": "q7",
        "text": "我有时会对别人比较粗鲁或不耐烦。",
        "trait": "A",
        "trait_name": "宜人性",
        "facet": "Respectfulness",
        "facet_name": "尊重性",
        "reverse": True,
    },
    {
        "id": "q12",
        "text": "我倾向于相信别人。",
        "trait": "A",
        "trait_name": "宜人性",
        "facet": "Trust",
        "facet_name": "信任",
        "reverse": False,
    },
    {
        "id": "q17",
        "text": "我有时会对他人比较冷淡，不太关心。",
        "trait": "A",
        "trait_name": "宜人性",
        "facet": "Compassion",
        "facet_name": "同情心",
        "reverse": True,
    },
    {
        "id": "q22",
        "text": "我认为自己尊重他人、有礼貌。",
        "trait": "A",
        "trait_name": "宜人性",
        "facet": "Respectfulness",
        "facet_name": "尊重性",
        "reverse": False,
    },
    {
        "id": "q27",
        "text": "我有时容易挑别人的毛病。",
        "trait": "A",
        "trait_name": "宜人性",
        "facet": "Trust",
        "facet_name": "信任",
        "reverse": True,
    },

    # C 尽责性
    {
        "id": "q3",
        "text": "我有时缺乏条理，做事不够有序。",
        "trait": "C",
        "trait_name": "尽责性",
        "facet": "Organization",
        "facet_name": "条理性",
        "reverse": True,
    },
    {
        "id": "q8",
        "text": "我开始任务时有些困难，容易拖延启动。",
        "trait": "C",
        "trait_name": "尽责性",
        "facet": "Productiveness",
        "facet_name": "效率性",
        "reverse": True,
    },
    {
        "id": "q13",
        "text": "我认为自己可靠，值得别人依赖。",
        "trait": "C",
        "trait_name": "尽责性",
        "facet": "Responsibility",
        "facet_name": "责任感",
        "reverse": False,
    },
    {
        "id": "q18",
        "text": "我认为自己整洁、有序。",
        "trait": "C",
        "trait_name": "尽责性",
        "facet": "Organization",
        "facet_name": "条理性",
        "reverse": False,
    },
    {
        "id": "q23",
        "text": "我能坚持完成任务，不轻易放弃。",
        "trait": "C",
        "trait_name": "尽责性",
        "facet": "Productiveness",
        "facet_name": "效率性",
        "reverse": False,
    },
    {
        "id": "q28",
        "text": "我有时比较粗心，容易忽略细节。",
        "trait": "C",
        "trait_name": "尽责性",
        "facet": "Responsibility",
        "facet_name": "责任感",
        "reverse": True,
    },

    # N 神经质 / 负性情绪
    {
        "id": "q4",
        "text": "我经常担心事情出问题。",
        "trait": "N",
        "trait_name": "神经质/负性情绪",
        "facet": "Anxiety",
        "facet_name": "焦虑",
        "reverse": False,
    },
    {
        "id": "q9",
        "text": "我有时容易感到低落或沮丧。",
        "trait": "N",
        "trait_name": "神经质/负性情绪",
        "facet": "Depression",
        "facet_name": "低落",
        "reverse": False,
    },
    {
        "id": "q14",
        "text": "我情绪比较稳定，不容易激动。",
        "trait": "N",
        "trait_name": "神经质/负性情绪",
        "facet": "Emotional Volatility",
        "facet_name": "情绪波动",
        "reverse": True,
    },
    {
        "id": "q19",
        "text": "我通常比较放松，能够处理压力。",
        "trait": "N",
        "trait_name": "神经质/负性情绪",
        "facet": "Anxiety",
        "facet_name": "焦虑",
        "reverse": True,
    },
    {
        "id": "q24",
        "text": "我通常有安全感，对自己比较满意。",
        "trait": "N",
        "trait_name": "神经质/负性情绪",
        "facet": "Depression",
        "facet_name": "低落",
        "reverse": True,
    },
    {
        "id": "q29",
        "text": "我情绪化，容易被事情影响。",
        "trait": "N",
        "trait_name": "神经质/负性情绪",
        "facet": "Emotional Volatility",
        "facet_name": "情绪波动",
        "reverse": False,
    },

    # O 开放性
    {
        "id": "q5",
        "text": "我对艺术、音乐或文学感兴趣。",
        "trait": "O",
        "trait_name": "开放性",
        "facet": "Aesthetic Sensitivity",
        "facet_name": "审美敏感性",
        "reverse": False,
    },
    {
        "id": "q10",
        "text": "我对抽象概念和理论兴趣较少。",
        "trait": "O",
        "trait_name": "开放性",
        "facet": "Intellectual Curiosity",
        "facet_name": "智识好奇心",
        "reverse": True,
    },
    {
        "id": "q15",
        "text": "我有原创想法，具有创造力。",
        "trait": "O",
        "trait_name": "开放性",
        "facet": "Creative Imagination",
        "facet_name": "创造想象力",
        "reverse": False,
    },
    {
        "id": "q20",
        "text": "我对艺术相关内容兴趣不高。",
        "trait": "O",
        "trait_name": "开放性",
        "facet": "Aesthetic Sensitivity",
        "facet_name": "审美敏感性",
        "reverse": True,
    },
    {
        "id": "q25",
        "text": "我喜欢深入思考复杂问题。",
        "trait": "O",
        "trait_name": "开放性",
        "facet": "Intellectual Curiosity",
        "facet_name": "智识好奇心",
        "reverse": False,
    },
    {
        "id": "q30",
        "text": "我认为自己创造力较少，想象力不太丰富。",
        "trait": "O",
        "trait_name": "开放性",
        "facet": "Creative Imagination",
        "facet_name": "创造想象力",
        "reverse": True,
    },
]


FACET_FIELDNAMES = [
    "facet_E_sociability",
    "facet_E_assertiveness",
    "facet_E_energy",
    "facet_A_compassion",
    "facet_A_respectfulness",
    "facet_A_trust",
    "facet_C_organization",
    "facet_C_productiveness",
    "facet_C_responsibility",
    "facet_N_anxiety",
    "facet_N_depression",
    "facet_N_emotional_volatility",
    "facet_O_aesthetic_sensitivity",
    "facet_O_intellectual_curiosity",
    "facet_O_creative_imagination",
]

SCENARIO_TASKS: list[dict[str, Any]] = [
    {
        "task_id": 1,
        "task_name": "还好赶上晨会了",
        "target_traits": ["外向性 E", "开放性 O"],
        "main_prompt": "【场景背景】你刚加入一个项目组两周。明天下午，团队要向客户展示一份项目方案。现在是上午9:00，你踩点进入会议室，项目负责人以及开始组织晨会，要求大家确认展示内容、分工和风险点。此时负责人看向你说：“你负责的资料部分也很重要，你先简单说一下目前进度，以及你对明天展示的想法吧。”你会怎么回应？请写出你在会议上可能会说的话，并说明你为什么这样说。",
        "followup_prompt": "【心理小剧场】：如果你其实还不太熟悉团队成员，也不确定自己的想法是否成熟，你会选择主动表达、保守汇报，还是先观察别人呢？",
        "min_chars_1": 40,
        "min_chars_2": 15,
    },
    {
        "task_id": 2,
        "task_name": "有人反驳我？",
        "target_traits": ["宜人性 A", "开放性 O"],
        "main_prompt": "【场景背景】你刚说完有些紧张，刚想喘口气，一位资深同事就提出了不同看法。他认为你的方案太理想化，明天展示应该采用更保守的表达方式。而紧接着另一位同事则说：这个想法有创新性呀，值得保留。会议气氛开始有些分歧。面对这种情况，你会怎么回应？你会坚持自己的想法、调整表达、先听别人意见，还是尝试协调？请写出你的具体做法。",
        "followup_prompt": "【心理小剧场】：如果这位资深同事语气比较强硬，让你感觉自己的意见被否定了，你会怎么处理情绪和沟通方式呢？",
        "min_chars_1": 40,
        "min_chars_2": 15,
    },
    {
        "task_id": 3,
        "task_name": "我写错数据了！",
        "target_traits": ["尽责性 C", "神经质 N"],
        "main_prompt": "【场景背景】你跟上了节奏并融入了会议，却突然发现自己负责的数据表里有一处明显错误。如果不修正，可能会影响明天展示的可信度；但是仔细想想，如果现在提出，可能会让大家觉得你前期准备不充分。此时你会怎么做？你会立刻说出来、先私下检查，还是等会议结束后再处理？请描述你的判断过程。",
        "followup_prompt": "【心理小剧场】：如果时间已经很紧，而且这个错误可能影响整个团队的展示效果，你心里会有什么感受呢？",
        "min_chars_1": 40,
        "min_chars_2": 15,
    },
    {
        "task_id": 4,
        "task_name": "我就知道说出来要被骂",
        "target_traits": ["神经质 N", "宜人性 A"],
        "main_prompt": "【场景背景】你还是选择说明数据问题，项目负责人听完皱了皱眉，说：“这个问题为什么现在才发现？明天就要展示了，是不是前期检查不够仔细？”要知道，这句话是在会议上当着其他成员说的。你当下会怎么回应？你会解释原因、承认问题、提出补救方案，还是先保持沉默？请写出你可能说的话和真实想法。",
        "followup_prompt": "【心理小剧场】：如果你觉得负责人说得有一部分不公平，因为前期分工和资料来源本身也有问题，你会如何消化情绪并合理表达呢？",
        "min_chars_1": 40,
        "min_chars_2": 15,
    },
    {
        "task_id": 5,
        "task_name": "怎么还有事情...",
        "target_traits": ["尽责性 C", "开放性 O"],
        "main_prompt": "【场景背景】你有惊无险地解决了刚才的小插曲，然而会议快结束时，负责人突然说：“客户可能会问到竞品对比。你们今天最好再加一页竞品分析，明天展示时用得上。”但你原本下午已经安排了修改数据和整理展示稿，现在时间明显不够。面对这个临时新增任务，你会怎么安排优先级？你会直接接受、尝试协商、重新分工、压缩原计划，还是提出风险？请说明你的判断依据。",
        "followup_prompt": "【心理小剧场】：如果团队里有人说“先随便做一页，能交就行”，但你担心质量不够，你会怎么想或回应呢？",
        "min_chars_1": 40,
        "min_chars_2": 15,
    },
    {
        "task_id": 6,
        "task_name": "不是下班了吗？",
        "target_traits": ["宜人性 A", "尽责性 C"],
        "main_prompt": "【场景背景】忙活了一天终于快下班了，此时一位不太熟的同事来找你，说他的部分还没完成，希望你帮他一起处理。但你自己的数据修正和新增竞品分析也还没完全完成。如果他来不及，可能会影响整个团队明天的展示。你会怎么回应这位同事？你会直接帮忙、先完成自己的部分、帮他拆分任务、请负责人协调，还是拒绝？请具体说明。",
        "followup_prompt": "【心理小剧场】：如果你自己已经很累，或者晚上还有其他安排，你会怎么表达边界并妥善回答呢？",
        "min_chars_1": 40,
        "min_chars_2": 15,
    },
]


INVALID_PATTERNS = [
    re.compile(r"^(哈|哈哈|哈哈哈|呵呵|嗯|啊|不知道|没有|没啥|随便|无|不知道说什么)[。！!,.，\s]*$"),
    re.compile(r"(.)\1{8,}"),
]


class StartSessionRequest(BaseModel):
    consent: bool
    age_group: str = ""
    gender: str = ""
    education: str = ""


class BfiSubmitRequest(BaseModel):
    participant_id: str
    answers: dict[str, int]

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, answers: dict[str, int]) -> dict[str, int]:
        expected = {q["id"] for q in BFI_QUESTIONS}
        if set(answers.keys()) != expected:
            missing = sorted(expected - set(answers.keys()))
            extra = sorted(set(answers.keys()) - expected)
            raise ValueError(f"测评答案不完整。missing={missing}, extra={extra}")
        for key, value in answers.items():
            if value < 1 or value > 5:
                raise ValueError(f"{key} 必须在 1-5 分之间")
        return answers


class TaskSubmitRequest(BaseModel):
    participant_id: str
    task_id: int
    user_answer_1: str = Field(min_length=1)
    user_answer_2: str = Field(min_length=1)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                participant_id TEXT PRIMARY KEY,
                consent INTEGER NOT NULL,
                age_group TEXT,
                gender TEXT,
                education TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bfi_results (
                participant_id TEXT PRIMARY KEY,
                answers_json TEXT NOT NULL,
                bfi_E REAL NOT NULL,
                bfi_A REAL NOT NULL,
                bfi_C REAL NOT NULL,
                bfi_N REAL NOT NULL,
                bfi_O REAL NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(participant_id) REFERENCES sessions(participant_id)
            );

            CREATE TABLE IF NOT EXISTS task_responses (
                id TEXT PRIMARY KEY,
                participant_id TEXT NOT NULL,
                task_id INTEGER NOT NULL,
                task_name TEXT NOT NULL,
                target_traits TEXT NOT NULL,
                main_prompt TEXT NOT NULL,
                user_answer_1 TEXT NOT NULL,
                followup_prompt TEXT NOT NULL,
                user_answer_2 TEXT NOT NULL,
                full_text TEXT NOT NULL,
                char_count INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                quality_flag TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(participant_id, task_id),
                FOREIGN KEY(participant_id) REFERENCES sessions(participant_id)
            );
            """
        )


def adjusted(value: int, reverse: bool) -> int:
    return 6 - value if reverse else value


def reverse_map() -> dict[str, bool]:
    return {item["id"]: bool(item["reverse"]) for item in BFI_QUESTIONS}


def adjusted_answer(answers: dict[str, int], qid: str) -> float | None:
    """
    根据 BFI_QUESTIONS 里的 reverse 标记，返回某一题的反向处理后分数。
    如果某个旧数据没有这道题，就返回 None，避免导出旧数据时报错。
    """
    if qid not in answers:
        return None

    value = answers[qid]
    reverse = reverse_map().get(qid, False)
    return float(adjusted(int(value), reverse))


def mean_score(values: list[float | None]) -> float | str:
    """
    只要有缺失题，就返回空字符串。
    这样旧的 BFI-10 数据不会导致 CSV 导出崩掉。
    """
    if any(value is None for value in values):
        return ""

    valid_values = [float(value) for value in values]
    return round(sum(valid_values) / len(valid_values), 2)


def compute_bfi_facets(answers: dict[str, int]) -> dict[str, float | str]:
    return {
        "facet_E_sociability": mean_score([
            adjusted_answer(answers, "q1"),
            adjusted_answer(answers, "q16"),
        ]),
        "facet_E_assertiveness": mean_score([
            adjusted_answer(answers, "q6"),
            adjusted_answer(answers, "q21"),
        ]),
        "facet_E_energy": mean_score([
            adjusted_answer(answers, "q11"),
            adjusted_answer(answers, "q26"),
        ]),

        "facet_A_compassion": mean_score([
            adjusted_answer(answers, "q2"),
            adjusted_answer(answers, "q17"),
        ]),
        "facet_A_respectfulness": mean_score([
            adjusted_answer(answers, "q7"),
            adjusted_answer(answers, "q22"),
        ]),
        "facet_A_trust": mean_score([
            adjusted_answer(answers, "q12"),
            adjusted_answer(answers, "q27"),
        ]),

        "facet_C_organization": mean_score([
            adjusted_answer(answers, "q3"),
            adjusted_answer(answers, "q18"),
        ]),
        "facet_C_productiveness": mean_score([
            adjusted_answer(answers, "q8"),
            adjusted_answer(answers, "q23"),
        ]),
        "facet_C_responsibility": mean_score([
            adjusted_answer(answers, "q13"),
            adjusted_answer(answers, "q28"),
        ]),

        "facet_N_anxiety": mean_score([
            adjusted_answer(answers, "q4"),
            adjusted_answer(answers, "q19"),
        ]),
        "facet_N_depression": mean_score([
            adjusted_answer(answers, "q9"),
            adjusted_answer(answers, "q24"),
        ]),
        "facet_N_emotional_volatility": mean_score([
            adjusted_answer(answers, "q14"),
            adjusted_answer(answers, "q29"),
        ]),

        "facet_O_aesthetic_sensitivity": mean_score([
            adjusted_answer(answers, "q5"),
            adjusted_answer(answers, "q20"),
        ]),
        "facet_O_intellectual_curiosity": mean_score([
            adjusted_answer(answers, "q10"),
            adjusted_answer(answers, "q25"),
        ]),
        "facet_O_creative_imagination": mean_score([
            adjusted_answer(answers, "q15"),
            adjusted_answer(answers, "q30"),
        ]),
    }


def compute_bfi_scores(answers: dict[str, int]) -> dict[str, float]:
    q = {
        item["id"]: adjusted(answers[item["id"]], bool(item["reverse"]))
        for item in BFI_QUESTIONS
    }

    return {
        "bfi_E": round((q["q1"] + q["q6"] + q["q11"] + q["q16"] + q["q21"] + q["q26"]) / 6, 2),
        "bfi_A": round((q["q2"] + q["q7"] + q["q12"] + q["q17"] + q["q22"] + q["q27"]) / 6, 2),
        "bfi_C": round((q["q3"] + q["q8"] + q["q13"] + q["q18"] + q["q23"] + q["q28"]) / 6, 2),
        "bfi_N": round((q["q4"] + q["q9"] + q["q14"] + q["q19"] + q["q24"] + q["q29"]) / 6, 2),
        "bfi_O": round((q["q5"] + q["q10"] + q["q15"] + q["q20"] + q["q25"] + q["q30"]) / 6, 2),
    }


def char_count(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))


def word_count(text: str) -> int:
    words = [w for w in re.split(r"\s+", (text or "").strip()) if w]
    return len(words)


def is_low_quality(text: str) -> bool:
    stripped = re.sub(r"\s+", "", text or "")
    if not stripped:
        return True
    return any(pattern.search(stripped) for pattern in INVALID_PATTERNS)


def get_task(task_id: int) -> dict[str, Any]:
    for task in SCENARIO_TASKS:
        if task["task_id"] == task_id:
            return task
    raise HTTPException(status_code=404, detail="任务不存在")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    return {
        "bfi_version": BFI_VERSION,
        "scale": {
            "1": "非常不同意",
            "2": "比较不同意",
            "3": "一般/不确定",
            "4": "比较同意",
            "5": "非常同意",
        },
        "bfi_questions": BFI_QUESTIONS,
        "scenario_tasks": SCENARIO_TASKS,
    }


@app.post("/api/session/start")
def start_session(payload: StartSessionRequest) -> dict[str, Any]:
    if not payload.consent:
        raise HTTPException(status_code=400, detail="需要先勾选知情同意")
    participant_id = f"P_{uuid.uuid4().hex[:10]}"
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions(participant_id, consent, age_group, gender, education, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (participant_id, 1, payload.age_group, payload.gender, payload.education, now_iso()),
        )
    return {"participant_id": participant_id}


@app.post("/api/bfi/submit")
def submit_bfi(payload: BfiSubmitRequest) -> dict[str, Any]:
    with connect() as conn:
        session = conn.execute(
            "SELECT participant_id FROM sessions WHERE participant_id = ?",
            (payload.participant_id,),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="participant_id 不存在，请先创建 session")
        scores = compute_bfi_scores(payload.answers)
        facets = compute_bfi_facets(payload.answers)
        conn.execute(
            """
            INSERT INTO bfi_results(participant_id, answers_json, bfi_E, bfi_A, bfi_C, bfi_N, bfi_O, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(participant_id) DO UPDATE SET
                answers_json = excluded.answers_json,
                bfi_E = excluded.bfi_E,
                bfi_A = excluded.bfi_A,
                bfi_C = excluded.bfi_C,
                bfi_N = excluded.bfi_N,
                bfi_O = excluded.bfi_O,
                created_at = excluded.created_at
            """,
            (
                payload.participant_id,
                json.dumps(payload.answers, ensure_ascii=False),
                scores["bfi_E"],
                scores["bfi_A"],
                scores["bfi_C"],
                scores["bfi_N"],
                scores["bfi_O"],
                now_iso(),
            ),
        )
    return {"scores": scores, "facets": facets}


@app.post("/api/task/submit")
def submit_task(payload: TaskSubmitRequest) -> dict[str, Any]:
    task = get_task(payload.task_id)
    answer1_chars = char_count(payload.user_answer_1)
    answer2_chars = char_count(payload.user_answer_2)
    if answer1_chars < task["min_chars_1"]:
        raise HTTPException(status_code=400, detail=f"第一轮回答至少 {task['min_chars_1']} 字")
    if answer2_chars < task["min_chars_2"]:
        raise HTTPException(status_code=400, detail=f"追问回答至少 {task['min_chars_2']} 字")
    full_text = f"{task['main_prompt']}\n用户回答1：{payload.user_answer_1.strip()}\n追问：{task['followup_prompt']}\n用户回答2：{payload.user_answer_2.strip()}"
    quality_flag = "low_quality" if is_low_quality(payload.user_answer_1) or is_low_quality(payload.user_answer_2) else "ok"
    with connect() as conn:
        session = conn.execute(
            "SELECT participant_id FROM sessions WHERE participant_id = ?",
            (payload.participant_id,),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="participant_id 不存在，请先创建 session")
        bfi = conn.execute(
            "SELECT participant_id FROM bfi_results WHERE participant_id = ?",
            (payload.participant_id,),
        ).fetchone()
        if not bfi:
            raise HTTPException(status_code=400, detail="请先完成前面的测评问卷")
        conn.execute(
            """
            INSERT INTO task_responses(
                id, participant_id, task_id, task_name, target_traits, main_prompt,
                user_answer_1, followup_prompt, user_answer_2, full_text,
                char_count, word_count, quality_flag, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(participant_id, task_id) DO UPDATE SET
                user_answer_1 = excluded.user_answer_1,
                user_answer_2 = excluded.user_answer_2,
                full_text = excluded.full_text,
                char_count = excluded.char_count,
                word_count = excluded.word_count,
                quality_flag = excluded.quality_flag,
                created_at = excluded.created_at
            """,
            (
                str(uuid.uuid4()),
                payload.participant_id,
                task["task_id"],
                task["task_name"],
                ",".join(task["target_traits"]),
                task["main_prompt"],
                payload.user_answer_1.strip(),
                task["followup_prompt"],
                payload.user_answer_2.strip(),
                full_text,
                char_count(full_text),
                word_count(full_text),
                quality_flag,
                now_iso(),
            ),
        )
    return {"status": "saved", "quality_flag": quality_flag, "char_count": char_count(full_text)}


@app.get("/api/export/csv")
def export_csv() -> StreamingResponse:
    fieldnames = [
        "participant_id",
        "age_group",
        "gender",
        "education",
        "bfi_version",
        *[f"bfi_q{i}" for i in range(1, 31)],
        "bfi_E",
        "bfi_A",
        "bfi_C",
        "bfi_N",
        "bfi_O",
        *FACET_FIELDNAMES,
        "task_id",
        "task_name",
        "target_traits",
        "main_prompt",
        "user_answer_1",
        "followup_prompt",
        "user_answer_2",
        "full_text",
        "char_count",
        "word_count",
        "quality_flag",
        "created_at",
    ]
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
              s.participant_id, s.age_group, s.gender, s.education,
              b.answers_json, b.bfi_E, b.bfi_A, b.bfi_C, b.bfi_N, b.bfi_O,
              t.task_id, t.task_name, t.target_traits, t.main_prompt,
              t.user_answer_1, t.followup_prompt, t.user_answer_2, t.full_text,
              t.char_count, t.word_count, t.quality_flag, t.created_at
            FROM task_responses t
            JOIN sessions s ON s.participant_id = t.participant_id
            JOIN bfi_results b ON b.participant_id = t.participant_id
            ORDER BY s.created_at, t.task_id
            """
        ).fetchall()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        answers = json.loads(row["answers_json"])
        item = {key: row[key] for key in row.keys() if key != "answers_json"}

        item["bfi_version"] = BFI_VERSION

        for i in range(1, 31):
            item[f"bfi_q{i}"] = answers.get(f"q{i}", "")

        facets = compute_bfi_facets(answers)
        for field in FACET_FIELDNAMES:
            item[field] = facets.get(field, "")

        writer.writerow(item)

    content = output.getvalue().encode("utf-8-sig")
    filename = f"personality_dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/progress/{participant_id}")
def get_progress(participant_id: str) -> dict[str, Any]:
    with connect() as conn:
        completed = conn.execute(
            "SELECT task_id FROM task_responses WHERE participant_id = ? ORDER BY task_id",
            (participant_id,),
        ).fetchall()
    return {"completed_task_ids": [row["task_id"] for row in completed], "total_tasks": len(SCENARIO_TASKS)}


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    html_path = FRONTEND_DIR / "index.html"
    return html_path.read_text(encoding="utf-8")
