const state = {
  participantId: localStorage.getItem("participant_id") || "",
  config: null,
  bfiAnswers: {},
  bfiScores: null,
  currentTaskIndex: 0,
};

const $ = (id) => document.getElementById(id);

const REPORT_TRAITS = [
  {
    key: "bfi_E",
    name: "外向性",
    english: "Extraversion",
    meaning: "外向性反映一个人在社交互动、表达主动性和精力水平上的倾向。",
    workplace: "分数较高时，你可能更愿意主动沟通、参与讨论，也更容易在团队中表达自己的想法。分数较低时，你可能更偏好独立思考、安静推进任务，先观察再表达。",
  },
  {
    key: "bfi_A",
    name: "宜人性",
    english: "Agreeableness",
    meaning: "宜人性反映一个人在合作、体谅他人、信任和维持关系方面的倾向。",
    workplace: "分数较高时，你可能更重视团队氛围，愿意倾听和协调冲突。分数较低时，你可能更直接表达判断，比较关注事情本身是否合理。",
  },
  {
    key: "bfi_C",
    name: "尽责性",
    english: "Conscientiousness",
    meaning: "尽责性反映一个人在计划性、责任感、执行力和细节管理方面的倾向。",
    workplace: "分数较高时，你可能更习惯提前规划、按时交付并检查细节。分数较低时，你可能更灵活随性，适合在变化中快速调整节奏。",
  },
  {
    key: "bfi_N",
    name: "神经质 / 情绪敏感性",
    english: "Neuroticism",
    meaning: "情绪敏感性反映一个人面对压力、变化和不确定情境时的情绪反应强度。",
    workplace: "分数较高时，你可能更容易察觉风险和压力信号，也更需要稳定的信息与支持。分数较低时，你可能在压力场景中更放松，情绪恢复速度相对更快。",
  },
  {
    key: "bfi_O",
    name: "开放性",
    english: "Openness",
    meaning: "开放性反映一个人对新想法、新经验、创造性方案和复杂问题的兴趣。",
    workplace: "分数较高时，你可能更愿意尝试新方法、提出创意和探索不同视角。分数较低时，你可能更偏好清晰、成熟、可验证的做法。",
  },
];

function countChars(text) {
  return (text || "").replace(/\s+/g, "").length;
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $(`screen-${name}`).classList.add("active");
  const flowChrome = $("flowChrome");
  if (flowChrome) {
    flowChrome.classList.toggle("hidden", name === "cover");
  }
  document.body.classList.toggle("cover-mode", name === "cover");
  document.body.classList.toggle("bfi-mode", name === "bfi");
  const labels = {
    cover: "封面",
    info: "基本信息",
    bfi: "人格倾向自评",
    task: "职场情境任务",
    finish: "结果报告",
  };
  if ($("stepLabel")) {
    $("stepLabel").innerText = labels[name] || name;
  }
  const taskProgress = state.config?.scenario_tasks?.length
    ? 55 + Math.round((state.currentTaskIndex / state.config.scenario_tasks.length) * 35)
    : 55;
  const progress = { cover: 0, info: 18, bfi: 45, task: taskProgress, finish: 100 }[name] || 0;
  if ($("progressFill")) {
    $("progressFill").style.width = `${progress}%`;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError(id) {
  const el = $(id);
  el.textContent = "";
  el.classList.add("hidden");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "请求失败");
  }
  return data;
}

async function loadConfig() {
  state.config = await api("/api/config");
  renderBfi();
}

function getSortedBfiQuestions() {
  return [...state.config.bfi_questions].sort((a, b) => {
    const aNum = Number(String(a.id).replace("q", ""));
    const bNum = Number(String(b.id).replace("q", ""));
    return aNum - bNum;
  });
}

function updateBfiProgress() {
  const total = state.config?.bfi_questions?.length || 0;
  const answered = Object.keys(state.bfiAnswers).length;
  const percent = total ? Math.round((answered / total) * 100) : 0;

  const progressEl = $("bfiProgressText");
  const percentEl = $("bfiProgressPercent");
  const fillEl = $("bfiMiniFill");

  if (progressEl) {
    progressEl.innerHTML = `已完成 <strong>${answered}</strong> / ${total} 题`;
  }
  if (percentEl) {
    percentEl.innerText = `${percent}%`;
  }
  if (fillEl) {
    fillEl.style.width = `${percent}%`;
  }
}

function updateRadioSelectedStyle(questionId) {
  document.querySelectorAll(`input[name="${questionId}"]`).forEach((input) => {
    const label = input.closest("label");
    if (!label) return;

    if (input.checked) {
      label.classList.add("selected");
    } else {
      label.classList.remove("selected");
    }
  });
}

function renderBfi() {
  const list = $("bfiList");
  list.innerHTML = "";

  const questions = getSortedBfiQuestions();

  updateBfiProgress();

  questions.forEach((q, index) => {
    const row = document.createElement("div");
    row.className = "question-row";

    row.innerHTML = `
      <h3>${index + 1}. ${q.text}</h3>
      <div class="radio-line">
        ${[1, 2, 3, 4, 5].map((value) => `
          <label>
            <input type="radio" name="${q.id}" value="${value}" ${state.bfiAnswers[q.id] === value ? "checked" : ""}>
            <span>${value}</span>
          </label>
        `).join("")}
      </div>
    `;

    list.appendChild(row);
    updateRadioSelectedStyle(q.id);
  });

  list.onchange = (event) => {
    if (event.target.matches("input[type=radio]")) {
      state.bfiAnswers[event.target.name] = Number(event.target.value);
      updateRadioSelectedStyle(event.target.name);
      updateBfiProgress();
      hideError("bfiError");
    }
  };
}

function buildEducationProfile() {
  const identity = $("identityType").value;
  const note = $("education").value.trim();
  return [
    identity ? `身份类型：${identity}` : "",
    note ? `补充说明：${note}` : "",
  ].filter(Boolean).join("；");
}

async function startSession() {
  const data = await api("/api/session/start", {
    method: "POST",
    body: JSON.stringify({
      consent: true,
      age_group: $("ageGroup").value,
      gender: $("gender").value,
      education: buildEducationProfile(),
    }),
  });
  state.participantId = data.participant_id;
  state.bfiAnswers = {};
  state.bfiScores = null;
  state.currentTaskIndex = 0;

  localStorage.setItem("participant_id", state.participantId);

  renderBfi();
  showScreen("bfi");
}

async function submitBfi() {
  hideError("bfiError");

  const questions = getSortedBfiQuestions();
  const answers = {};

  for (const q of questions) {
    const selected = document.querySelector(`input[name="${q.id}"]:checked`);

    if (!selected) {
      const qNumber = String(q.id).replace("q", "");
      showError("bfiError", `请完成第 ${qNumber} 题。`);
      return;
    }

    answers[q.id] = Number(selected.value);
  }

  try {
    const data = await api("/api/bfi/submit", {
      method: "POST",
      body: JSON.stringify({
        participant_id: state.participantId,
        answers,
      }),
    });

    state.bfiAnswers = answers;
    state.bfiScores = data.scores;
    state.currentTaskIndex = 0;

    renderTask();
    showScreen("task");
  } catch (err) {
    showError("bfiError", err.message);
  }
}

function renderTask() {
  hideError("taskError");
  const task = state.config.scenario_tasks[state.currentTaskIndex];
  $("taskCounter").innerText = `第 ${state.currentTaskIndex + 1} 轮 / 共 ${state.config.scenario_tasks.length} 轮`;
  $("taskName").innerText = task.task_name;
  // 不在页面展示目标人格维度，避免用户按标签作答。
  const targetTraitsEl = $("targetTraits");
  if (targetTraitsEl) {
    targetTraitsEl.innerText = "";
    targetTraitsEl.classList.add("hidden");
  }
  $("mainPrompt").innerText = task.main_prompt;
  $("followupPrompt").innerText = task.followup_prompt;
  $("answer1").value = "";
  $("answer2").value = "";
  $("answer1Min").innerText = task.min_chars_1;
  $("answer2Min").innerText = task.min_chars_2;
  $("submitTaskBtn").innerText = state.currentTaskIndex === state.config.scenario_tasks.length - 1
    ? "提交并生成我的职场人格画像"
    : "提交本轮，进入下一轮";
  updateCounts();
}

function updateCounts() {
  $("answer1Count").innerText = countChars($("answer1").value);
  $("answer2Count").innerText = countChars($("answer2").value);
}

async function submitTask() {
  hideError("taskError");
  const task = state.config.scenario_tasks[state.currentTaskIndex];
  const answer1 = $("answer1").value.trim();
  const answer2 = $("answer2").value.trim();
  if (countChars(answer1) < task.min_chars_1) {
    showError("taskError", `第一轮回答至少 ${task.min_chars_1} 字。`);
    return;
  }
  if (countChars(answer2) < task.min_chars_2) {
    showError("taskError", `追问回答至少 ${task.min_chars_2} 字。`);
    return;
  }
  const originalButtonText = $("submitTaskBtn").innerText;
  let submitted = false;
  try {
    $("submitTaskBtn").disabled = true;
    $("submitTaskBtn").innerText = state.currentTaskIndex === state.config.scenario_tasks.length - 1
      ? "正在生成你的结果"
      : "正在提交";
    await api("/api/task/submit", {
      method: "POST",
      body: JSON.stringify({
        participant_id: state.participantId,
        task_id: task.task_id,
        user_answer_1: answer1,
        user_answer_2: answer2,
      }),
    });
    submitted = true;
    state.currentTaskIndex += 1;
    if (state.currentTaskIndex >= state.config.scenario_tasks.length) {
      renderFinish();
      showScreen("finish");
    } else {
      renderTask();
    }
  } catch (err) {
    showError("taskError", err.message);
    $("submitTaskBtn").innerText = originalButtonText;
  } finally {
    $("submitTaskBtn").disabled = false;
    if (!submitted) {
      $("submitTaskBtn").innerText = originalButtonText;
    }
  }
}

function toPercentScore(score5) {
  if (score5 === undefined || score5 === null || score5 === "") return null;
  const numeric = Number(score5);
  if (Number.isNaN(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(((numeric - 1) / 4) * 100)));
}

function renderFinish() {
  const scores = state.bfiScores || {};

  $("scoreBox").innerHTML = REPORT_TRAITS.map((trait) => {
    const percent = toPercentScore(scores[trait.key]);
    const displayScore = percent === null ? "-" : `${percent}/100`;
    const barWidth = percent === null ? 0 : percent;
    return `
      <article class="trait-card">
        <div class="trait-heading">
          <div>
            <h3>${trait.name}</h3>
            <p>${trait.english}</p>
          </div>
          <strong>${displayScore}</strong>
        </div>
        <div class="trait-meter" aria-label="${trait.name}百分制结果">
          <div style="width: ${barWidth}%"></div>
        </div>
        <p><b>解释：</b>${trait.meaning}</p>
        <p><b>职场表现：</b>${trait.workplace}</p>
      </article>
    `;
  }).join("");
}

function restart() {
  localStorage.removeItem("participant_id");

  state.participantId = "";
  state.bfiAnswers = {};
  state.bfiScores = null;
  state.currentTaskIndex = 0;

  document.querySelectorAll("input[type=radio]").forEach((input) => {
    input.checked = false;
  });

  document.querySelectorAll(".radio-line label").forEach((label) => {
    label.classList.remove("selected");
  });

  updateBfiProgress();
  showScreen("cover");
}

$("coverStartBtn").addEventListener("click", () => showScreen("info"));
$("startBtn").addEventListener("click", startSession);
$("submitBfiBtn").addEventListener("click", submitBfi);
$("submitTaskBtn").addEventListener("click", submitTask);
$("restartBtn").addEventListener("click", restart);
$("answer1").addEventListener("input", updateCounts);
$("answer2").addEventListener("input", updateCounts);

loadConfig().catch((err) => alert(`加载配置失败：${err.message}`));
