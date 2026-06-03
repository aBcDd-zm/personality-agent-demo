const state = {
  participantId: localStorage.getItem("participant_id") || "",
  config: null,
  bfiAnswers: {},
  bfiScores: null,
  currentTaskIndex: 0,
  taskAnswers: [],
};

const $ = (id) => document.getElementById(id);

// 后续拿到真实小程序二维码时，把这里替换为二维码图片路径。
const POSTER_QR_IMAGE_SRC = "";

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
    name: "神经质",
    english: "Neuroticism",
    meaning: "神经质即情绪敏感性，反映一个人面对压力、变化和不确定情境时的情绪反应强度。",
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

const POSTER_TRAITS = [
  { key: "bfi_O", name: "开放性", english: "Openness" },
  { key: "bfi_C", name: "尽责性", english: "Conscientiousness" },
  { key: "bfi_E", name: "外向性", english: "Extraversion" },
  { key: "bfi_A", name: "宜人性", english: "Agreeableness" },
  { key: "bfi_N", name: "神经质", english: "Neuroticism" },
];

function countChars(text) {
  return (text || "").replace(/\s+/g, "").length;
}

function showScreen(name) {
  if (name !== "bfi") hideError("bfiError");
  if (name !== "task") hideError("taskError");

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
    task: "职场情境问答",
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

function updateTaskProgressBar() {
  if (!$("progressFill") || !state.config?.scenario_tasks?.length) return;

  const total = state.config.scenario_tasks.length;
  const completed = state.currentTaskIndex;

  const progress = 55 + Math.round((completed / total) * 35);
  $("progressFill").style.width = `${progress}%`;
}

function showError(id, message) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError(id) {
  const el = $(id);
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function clearValidationErrors() {
  hideError("bfiError");
  hideError("taskError");
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

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReviewText(text) {
  return escapeHtml(text)
    .replace(/\n/g, "<br>")
    .replace(/【场景背景】/g, '<strong class="prompt-label">【场景背景】</strong>')
    .replace(/【心理小剧场】/g, '<strong class="prompt-label">【心理小剧场】</strong>');
}

function formatWorkplaceText(text) {
  return escapeHtml(text).replace(/。分数较低时/g, "。<br>分数较低时");
}

function getBfiValueLabel(value) {
  const labels = {
    1: "非常不同意",
    2: "比较不同意",
    3: "一般/不确定",
    4: "比较同意",
    5: "非常同意",
  };
  return labels[value] || "";
}

function getBfiAnsweredQuestions() {
  if (!state.config?.bfi_questions) return [];

  return getSortedBfiQuestions()
    .filter((q) => state.bfiAnswers[q.id] !== undefined)
    .map((q) => ({
      ...q,
      number: Number(String(q.id).replace("q", "")),
      value: state.bfiAnswers[q.id],
    }));
}

function getBfiReviewItemsHtml(compact = false) {
  const answered = getBfiAnsweredQuestions();

  if (!answered.length) {
    return `<p class="review-empty">还没有作答。</p>`;
  }

  return answered.map((item) => `
    <div class="bfi-answer-card ${compact ? "compact" : ""}">
      <div class="bfi-answer-top">
        <strong>第 ${item.number} 题</strong>
        <span class="score-pill score-${item.value}">${item.value} 分</span>
      </div>
      <p>${escapeHtml(item.text)}</p>
      <small>${getBfiValueLabel(item.value)}</small>
    </div>
  `).join("");
}

function renderBfiReviewList() {
  const listEl = $("bfiReviewList");
  const detailsEl = $("bfiReviewDetails");

  if (!listEl || !detailsEl || !state.config?.bfi_questions) return;

  const total = state.config.bfi_questions.length;
  const answered = getBfiAnsweredQuestions().length;

  const summaryEl = detailsEl.querySelector("summary");
  if (summaryEl) {
    summaryEl.innerHTML = `已答问题回顾（<span class="review-count-current">${answered}</span> / ${total}）`;
  }

  listEl.innerHTML = getBfiReviewItemsHtml(true);
}

function renderBfiReviewPanel(containerId) {
  const el = $(containerId);
  if (!el) return;

  const total = state.config?.bfi_questions?.length || 0;
  const answered = getBfiAnsweredQuestions().length;

  if (!answered) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }

  el.classList.remove("hidden");
  el.innerHTML = `
    <details>
      <summary>问卷答案回顾（${answered} / ${total}）</summary>
      <div class="review-list bfi-review-grid">
        ${getBfiReviewItemsHtml(true)}
      </div>
    </details>
  `;
}

function saveTaskAnswer(task, answer1, answer2) {
  const saved = {
    task_id: task.task_id,
    task_name: task.task_name,
    main_prompt: task.main_prompt,
    followup_prompt: task.followup_prompt,
    user_answer_1: answer1,
    user_answer_2: answer2,
  };

  const existingIndex = state.taskAnswers.findIndex(
    (item) => item.task_id === task.task_id
  );

  if (existingIndex >= 0) {
    state.taskAnswers[existingIndex] = saved;
  } else {
    state.taskAnswers.push(saved);
  }
}

function renderTaskAnswerReview(containerId) {
  const el = $(containerId);
  if (!el) return;

  const answers = [...state.taskAnswers].sort(
    (a, b) => Number(a.task_id) - Number(b.task_id)
  );

  if (!answers.length) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }

  el.classList.remove("hidden");
  el.innerHTML = `
    <details>
      <summary>已答情境内容回看（${answers.length} 轮）</summary>
      <div class="review-list">
        ${answers.map((item) => `
          <div class="review-item">
            <h3>第 ${item.task_id} 轮：${escapeHtml(item.task_name)}</h3>

            <div class="review-block">
              <p>${formatReviewText(item.main_prompt)}</p>
            </div>

            <div class="review-block user-answer">
              <p>${formatReviewText(item.user_answer_1)}</p>
            </div>

            <div class="review-block">
              <p>${formatReviewText(item.followup_prompt)}</p>
            </div>

            <div class="review-block user-answer">
              <p>${formatReviewText(item.user_answer_2)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function renderBfi() {
  const list = $("bfiList");
  list.innerHTML = "";

  const questions = getSortedBfiQuestions();

  updateBfiProgress();
  renderBfiReviewList();

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
      renderBfiReviewList();
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
  clearValidationErrors();
  hidePoster();

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
  state.taskAnswers = [];

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
    state.taskAnswers = [];

    clearValidationErrors();
    renderTask();
    showScreen("task");
  } catch (err) {
    showError("bfiError", err.message);
  }
}

function renderTask() {
  hideError("taskError");

  updateTaskProgressBar();

  const task = state.config.scenario_tasks[state.currentTaskIndex];

  renderTaskAnswerReview("taskReview");

  $("taskCounter").innerText = `第 ${state.currentTaskIndex + 1} 轮 / 共 ${state.config.scenario_tasks.length} 轮`;
  $("taskName").innerText = task.task_name;

  // 不在页面展示目标人格维度，避免用户按标签作答。
  const targetTraitsEl = $("targetTraits");
  if (targetTraitsEl) {
    targetTraitsEl.innerText = "";
    targetTraitsEl.classList.add("hidden");
  }

  $("mainPrompt").innerHTML = formatReviewText(task.main_prompt);
  $("followupPrompt").innerHTML = formatReviewText(task.followup_prompt);

  $("answer1").value = "";
  $("answer2").value = "";

  $("answer1Min").innerText = task.min_chars_1;
  $("answer2Min").innerText = task.min_chars_2;

  const currentRound = state.currentTaskIndex + 1;
  const totalRounds = state.config.scenario_tasks.length;
  const nextRound = currentRound + 1;

  $("submitTaskBtn").innerText =
    currentRound === totalRounds
      ? "提交本轮，生成结果"
      : `提交本轮，进入第 ${nextRound} / ${totalRounds} 轮`;

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

    saveTaskAnswer(task, answer1, answer2);

    submitted = true;
    state.currentTaskIndex += 1;
    if (state.currentTaskIndex >= state.config.scenario_tasks.length) {
      clearValidationErrors();
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

function getPosterScores() {
  const scores = state.bfiScores || {};

  return POSTER_TRAITS.map((trait) => {
    const percent = toPercentScore(scores[trait.key]);

    return {
      ...trait,
      percent,
      displayScore: percent === null ? "-" : `${percent}`,
    };
  });
}

const POSTER_PAIR_PERSONAS = {
  "bfi_O+bfi_C": {
    name: "创意执行者",
    text: "你既容易提出新想法，也重视把想法落到计划与行动中，适合在探索和执行之间搭桥。",
  },
  "bfi_O+bfi_E": {
    name: "灵感连接者",
    text: "你更容易被新想法吸引，也愿意在互动中表达和连接资源，适合带动讨论与创意生成。",
  },
  "bfi_O+bfi_A": {
    name: "共情创想者",
    text: "你既关注新的可能性，也在意他人的感受，适合提出有温度、有想象力的协作方案。",
  },
  "bfi_O+bfi_N": {
    name: "敏锐探索者",
    text: "你对新想法和压力信号都比较敏感，容易捕捉细节、风险和新的可能性，适合在复杂问题中发现隐藏线索。",
  },
  "bfi_C+bfi_E": {
    name: "行动组织者",
    text: "你既有推动任务的执行意识，也愿意主动沟通，适合在团队中组织节奏、推进共识。",
  },
  "bfi_C+bfi_A": {
    name: "可靠协作者",
    text: "你重视责任、秩序和团队关系，适合承担稳定交付、协调配合和维护团队信任的角色。",
  },
  "bfi_C+bfi_N": {
    name: "谨慎推进者",
    text: "你重视计划和结果，也容易察觉压力与风险，适合在任务推进中提前发现问题、控制细节和减少失误。",
  },
  "bfi_E+bfi_A": {
    name: "能量连接者",
    text: "你更容易在互动中获得能量，也重视合作关系，适合沟通、连接资源和带动团队气氛。",
  },
  "bfi_E+bfi_N": {
    name: "敏感表达者",
    text: "你愿意表达和参与互动，也容易感受到压力与情绪变化，适合在沟通中捕捉他人反应并及时调整表达方式。",
  },
  "bfi_A+bfi_N": {
    name: "共情感知者",
    text: "你重视他人感受，也容易察觉压力和情绪信号，适合在团队中发现关系变化、理解他人需要并提供支持。",
  },
};

function getTraitOrderIndex(key) {
  return POSTER_TRAITS.findIndex((trait) => trait.key === key);
}

function sortTraitsByPosterOrder(traits) {
  return [...traits].sort(
    (a, b) => getTraitOrderIndex(a.key) - getTraitOrderIndex(b.key)
  );
}

function getPosterPairKey(pair) {
  return sortTraitsByPosterOrder(pair)
    .map((trait) => trait.key)
    .join("+");
}

function buildTraitPairs(traits) {
  const pairs = [];

  for (let i = 0; i < traits.length; i += 1) {
    for (let j = i + 1; j < traits.length; j += 1) {
      pairs.push(sortTraitsByPosterOrder([traits[i], traits[j]]));
    }
  }

  return pairs;
}

function getTopPosterTraitPair(posterScores) {
  const validScores = posterScores
    .filter((item) => Number.isFinite(item.percent))
    .sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      return getTraitOrderIndex(a.key) - getTraitOrderIndex(b.key);
    });

  if (validScores.length < 2) {
    const fallbackPair = sortTraitsByPosterOrder(posterScores.slice(0, 2));
    return {
      primaryPair: fallbackPair,
      candidatePairs: [fallbackPair],
      hasTie: false,
    };
  }

  const highestScore = validScores[0].percent;
  const topGroup = validScores.filter((item) => item.percent === highestScore);

  let candidatePairs = [];

  // 情况 1：最高分本身就有多个并列
  // 比如 外向性 58、开放性 58、宜人性 58
  // 那么它们之间的所有两两组合都可能成立
  if (topGroup.length >= 2) {
    candidatePairs = buildTraitPairs(topGroup);
  } else {
    // 情况 2：最高分只有一个，但第二高分有多个并列
    // 比如 外向性 58，开放性 54，神经质 54
    // 那么 外向性+开放性、外向性+神经质 都可能成立
    const secondScore = validScores[1].percent;
    const secondGroup = validScores.filter((item) => item.percent === secondScore);
    candidatePairs = secondGroup.map((item) =>
      sortTraitsByPosterOrder([validScores[0], item])
    );
  }

  return {
    primaryPair: candidatePairs[0],
    candidatePairs,
    hasTie: candidatePairs.length > 1,
  };
}

function getPosterPairPersona(pair) {
  const pairKey = getPosterPairKey(pair);

  return POSTER_PAIR_PERSONAS[pairKey] || {
    name: "职场探索者",
    text: "你正在形成属于自己的职场协作方式，适合在不同任务中继续观察自己的优势。",
  };
}

function getPairNames(pair) {
  return pair.map((item) => item.name).join(" × ");
}

function getTiePairText(candidatePairs) {
  const names = candidatePairs.map((pair) => getPairNames(pair));

  if (names.length <= 3) {
    return names.join("、");
  }

  return `${names.slice(0, 3).join("、")} 等 ${names.length} 种`;
}

function hidePoster() {
  const posterSection = $("posterSection");
  if (posterSection) {
    posterSection.innerHTML = "";
    posterSection.classList.add("hidden");
  }

  const posterButton = $("generatePosterBtn");
  if (posterButton) {
    posterButton.innerText = "感谢您的参与，点击生成人格海报";
    posterButton.disabled = false;
  }
}

function renderPoster() {
  const posterSection = $("posterSection");
  if (!posterSection) return;

  const posterScores = getPosterScores();
  const pairResult = getTopPosterTraitPair(posterScores);
  const primaryPair = pairResult.primaryPair;
  const primaryPairKeys = new Set(primaryPair.map((item) => item.key));
  const persona = getPosterPairPersona(primaryPair);
  const pairNames = getPairNames(primaryPair);

  const tieNote = pairResult.hasTie
    ? `<p class="poster-tie-note">检测到分数并列，可能画像组合：${getTiePairText(pairResult.candidatePairs)}。当前海报优先展示「${pairNames}」。</p>`
    : "";

  const qrMarkup = POSTER_QR_IMAGE_SRC
    ? `<img class="poster-qr-img" src="${escapeHtml(POSTER_QR_IMAGE_SRC)}" alt="扫码参与测评二维码">`
    : `<div class="poster-qr-placeholder" aria-hidden="true"></div>`;

  posterSection.innerHTML = `
    <article class="poster-card poster-card-v2" id="personalityPoster">
      <div class="poster-glow poster-glow-one"></div>
      <div class="poster-glow poster-glow-two"></div>

      <div class="poster-hero poster-hero-v2">
        <p class="poster-eyebrow">WORKPLACE PERSONA REPORT</p>
        <h3>「${persona.name}」</h3>

        <p class="poster-lead">
          你的职场关键词是 <strong>${pairNames}</strong><br>
          ${persona.text}
        </p>

        ${tieNote}
      </div>

      <div class="poster-radar-panel">
        <div class="poster-radar-title">
          <span>大五人格雷达图</span>
          <small>Big Five Profile</small>
        </div>

        <div class="poster-radar-wrap">
          <canvas id="posterRadar" aria-label="五项人格雷达图"></canvas>
        </div>
      </div>

      <div class="poster-score-grid poster-score-grid-v2">
        ${posterScores.map((item) => `
          <div class="poster-score-item ${primaryPairKeys.has(item.key) ? "is-top" : ""}">
            <span>${item.name}</span>
            <strong>${item.displayScore}</strong>
            <small>${item.english}</small>
          </div>
        `).join("")}
      </div>

      <div class="poster-bottom poster-bottom-v2">
        <div class="poster-qr-box">
          ${qrMarkup}
        </div>

        <div class="poster-bottom-copy">
          <strong>扫码生成你的职场人格画像</strong>
          <p>5 分钟完成测评，看看你在团队协作中的隐藏风格～</p>
        </div>
      </div>
    </article>
  `;

  posterSection.classList.remove("hidden");

  requestAnimationFrame(() => {
    drawPosterRadar(posterScores);
    posterSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function drawPosterRadar(items) {
  const canvas = $("posterRadar");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 280);
  const height = Math.max(rect.height, 280);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2 + 18;
  const radius = Math.min(width, height) * 0.36;
  const labelRadius = Math.min(width, height) * 0.43;
  const startAngle = -Math.PI / 2;

  function getPoint(index, valueRadius) {
    const angle = startAngle + (Math.PI * 2 * index) / items.length;
    return {
      x: centerX + Math.cos(angle) * valueRadius,
      y: centerY + Math.sin(angle) * valueRadius,
    };
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";

  for (let level = 5; level >= 1; level -= 1) {
    const levelRadius = (radius * level) / 5;
    ctx.beginPath();
    items.forEach((_, index) => {
      const point = getPoint(index, levelRadius);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  items.forEach((_, index) => {
    const point = getPoint(index, radius);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  });

  const dataPoints = items.map((item, index) => {
    const value = item.percent === null ? 0 : item.percent;
    return getPoint(index, radius * (value / 100));
  });

  ctx.beginPath();
  dataPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();

  dataPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  items.forEach((item, index) => {
    const labelPoint = getPoint(index, labelRadius);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(item.name, labelPoint.x, labelPoint.y - 8);
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`${item.displayScore}分`, labelPoint.x, labelPoint.y + 12);
  });
}

function renderFinish() {
  clearValidationErrors();
  hidePoster();
  renderBfiReviewPanel("bfiFinishReview");
  renderTaskAnswerReview("taskFinishReview");

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
        <div class="trait-text-row">
          <b>解释：</b>
          <span>${trait.meaning}</span>
        </div>

        <div class="trait-text-row">
          <b>职场表现：</b>
          <span>${formatWorkplaceText(trait.workplace)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function restart() {
  localStorage.removeItem("participant_id");
  clearValidationErrors();
  hidePoster();

  state.participantId = "";
  state.bfiAnswers = {};
  state.bfiScores = null;
  state.currentTaskIndex = 0;
  state.taskAnswers = [];

  document.querySelectorAll("input[type=radio]").forEach((input) => {
    input.checked = false;
  });

  document.querySelectorAll(".radio-line label").forEach((label) => {
    label.classList.remove("selected");
  });

  updateBfiProgress();
  renderBfiReviewList();
  showScreen("cover");
}

$("coverStartBtn").addEventListener("click", () => showScreen("info"));
$("startBtn").addEventListener("click", startSession);
$("submitBfiBtn").addEventListener("click", submitBfi);
$("submitTaskBtn").addEventListener("click", submitTask);
$("generatePosterBtn").addEventListener("click", renderPoster);
$("restartBtn").addEventListener("click", restart);
$("answer1").addEventListener("input", updateCounts);
$("answer2").addEventListener("input", updateCounts);

// ===== 开发预览模式：直接打开某个前端页面，不用完整走流程 =====
// 用法：
// /?dev=cover
// /?dev=info
// /?dev=bfi
// /?dev=task&round=3
// /?dev=finish
// /?dev=poster

const DEV_POSTER_PAIR_OPTIONS = [
  { key: "bfi_O+bfi_C", label: "开放 × 尽责" },
  { key: "bfi_O+bfi_E", label: "开放 × 外向" },
  { key: "bfi_O+bfi_A", label: "开放 × 宜人" },
  { key: "bfi_O+bfi_N", label: "开放 × 神经质" },
  { key: "bfi_C+bfi_E", label: "尽责 × 外向" },
  { key: "bfi_C+bfi_A", label: "尽责 × 宜人" },
  { key: "bfi_C+bfi_N", label: "尽责 × 神经质" },
  { key: "bfi_E+bfi_A", label: "外向 × 宜人" },
  { key: "bfi_E+bfi_N", label: "外向 × 神经质" },
  { key: "bfi_A+bfi_N", label: "宜人 × 神经质" },

  { key: "tie_top2", label: "最高两项并列" },
  { key: "tie_top3", label: "最高三项并列" },
  { key: "tie_top4", label: "最高四项并列" },
  { key: "tie_all5", label: "五项全并列" },

  { key: "tie_second2", label: "第二高两项并列" },
  { key: "tie_second3", label: "第二高三项并列" },
  { key: "tie_second4", label: "第二高四项并列" },
];

function percentToScore5(percent) {
  return 1 + (percent / 100) * 4;
}

function setDevTraitPercent(scores, key, percent) {
  scores[key] = percentToScore5(percent);
}

function makeDevBfiScores(devPairKey = "bfi_E+bfi_A") {
  const scores = {
    bfi_O: percentToScore5(44),
    bfi_C: percentToScore5(42),
    bfi_E: percentToScore5(40),
    bfi_A: percentToScore5(38),
    bfi_N: percentToScore5(54),
  };

  // 最高两项并列
  if (devPairKey === "tie_top2") {
    setDevTraitPercent(scores, "bfi_E", 82);
    setDevTraitPercent(scores, "bfi_A", 82);
    setDevTraitPercent(scores, "bfi_O", 60);
    setDevTraitPercent(scores, "bfi_C", 45);
    setDevTraitPercent(scores, "bfi_N", 40);
    return scores;
  }

  // 最高三项并列
  if (devPairKey === "tie_top3") {
   setDevTraitPercent(scores, "bfi_O", 82);
    setDevTraitPercent(scores, "bfi_E", 82);
    setDevTraitPercent(scores, "bfi_A", 82);
    setDevTraitPercent(scores, "bfi_C", 45);
    setDevTraitPercent(scores, "bfi_N", 40);
    return scores;
  }

  // 最高四项并列
  if (devPairKey === "tie_top4") {
    setDevTraitPercent(scores, "bfi_O", 82);
    setDevTraitPercent(scores, "bfi_C", 82);
    setDevTraitPercent(scores, "bfi_E", 82);
    setDevTraitPercent(scores, "bfi_A", 82);
    setDevTraitPercent(scores, "bfi_N", 40);
    return scores;
  }

  // 五项全并列
  if (devPairKey === "tie_all5") {
    setDevTraitPercent(scores, "bfi_O", 82);
    setDevTraitPercent(scores, "bfi_C", 82);
    setDevTraitPercent(scores, "bfi_E", 82);
    setDevTraitPercent(scores, "bfi_A", 82);
    setDevTraitPercent(scores, "bfi_N", 82);
    return scores;
  }

  // 第一高唯一，第二高两项并列
  if (devPairKey === "tie_second2") {
    setDevTraitPercent(scores, "bfi_E", 86);
    setDevTraitPercent(scores, "bfi_O", 76);
    setDevTraitPercent(scores, "bfi_C", 76);
    setDevTraitPercent(scores, "bfi_A", 44);
    setDevTraitPercent(scores, "bfi_N", 40);
    return scores;
  }

  // 第一高唯一，第二高三项并列
  if (devPairKey === "tie_second3") {
    setDevTraitPercent(scores, "bfi_E", 86);
    setDevTraitPercent(scores, "bfi_O", 76);
    setDevTraitPercent(scores, "bfi_C", 76);
    setDevTraitPercent(scores, "bfi_A", 76);
    setDevTraitPercent(scores, "bfi_N", 40);
    return scores;
  }

  // 第一高唯一，第二高四项并列
  if (devPairKey === "tie_second4") {
    setDevTraitPercent(scores, "bfi_E", 86);
    setDevTraitPercent(scores, "bfi_O", 76);
    setDevTraitPercent(scores, "bfi_C", 76);
    setDevTraitPercent(scores, "bfi_A", 76);
    setDevTraitPercent(scores, "bfi_N", 76);
    return scores;
  }

  const pairKeys = devPairKey.split("+");

  if (pairKeys.length === 2) {
    setDevTraitPercent(scores, pairKeys[0], 82);
    setDevTraitPercent(scores, pairKeys[1], 78);
  }

  return scores;
}

function makeDevTaskAnswer(task, index) {
  return {
    task_id: task.task_id,
    task_name: task.task_name,
    main_prompt: task.main_prompt,
    followup_prompt: task.followup_prompt,
    user_answer_1: `这是第 ${index + 1} 轮的模拟回答。我会先观察任务要求，再根据优先级安排工作。如果遇到冲突，我会尝试和同事沟通，并说明自己的判断依据。`,
    user_answer_2: `补充来说，我会关注时间成本、沟通方式和结果质量，尽量在不影响整体进度的情况下完成协作。`,
  };
}

function applyDevState(options = {}) {
  if (!state.config) return;

  state.participantId = "dev-preview-user";
  localStorage.setItem("participant_id", state.participantId);

  const questions = getSortedBfiQuestions();
  const demoAnswerValues = [4, 3, 5, 2, 4];

  state.bfiAnswers = {};
  questions.forEach((q, index) => {
    state.bfiAnswers[q.id] = demoAnswerValues[index % demoAnswerValues.length];
  });

  state.bfiScores = makeDevBfiScores(options.pair);

  const tasks = state.config.scenario_tasks || [];
  const round = Math.min(
    Math.max(Number(options.round || 1), 1),
    Math.max(tasks.length, 1)
  );

  state.currentTaskIndex = round - 1;

  if (options.fullTasks) {
    state.taskAnswers = tasks.map((task, index) => makeDevTaskAnswer(task, index));
  } else {
    state.taskAnswers = tasks
      .slice(0, Math.max(0, state.currentTaskIndex))
      .map((task, index) => makeDevTaskAnswer(task, index));
  }
}

function prefillDevTaskText() {
  const task = state.config?.scenario_tasks?.[state.currentTaskIndex];
  if (!task) return;

  if ($("answer1")) {
    $("answer1").value = "我会先确认目前最紧急的问题是什么，再判断是否需要马上回应。如果同事提出不同意见，我会先听完对方理由，再结合任务目标给出自己的想法。";
  }

  if ($("answer2")) {
    $("answer2").value = "我会尽量保持沟通清楚，避免情绪化表达，同时确保任务能继续推进。";
  }

  updateCounts();
}

const ENABLE_DEV_PREVIEW =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost";

function setupDevPreview() {
  if (!ENABLE_DEV_PREVIEW) return;

  const params = new URLSearchParams(window.location.search);
  const page = params.get("dev");

  if (!page) return;

  const allowedPages = ["cover", "info", "bfi", "task", "finish", "poster"];
  if (!allowedPages.includes(page)) return;

  const round = Number(params.get("round") || 1);
  const pair = (params.get("pair") || "bfi_E+bfi_A").replaceAll(" ", "+");

  applyDevState({
    round,
    pair,
    fullTasks: page === "finish" || page === "poster",
  });

  renderBfi();

  if (page === "task") {
    renderTask();
    showScreen("task");
    prefillDevTaskText();
  } else if (page === "finish") {
    renderFinish();
    showScreen("finish");
  } else if (page === "poster") {
    renderFinish();
    showScreen("finish");
    renderPoster();
  } else {
    showScreen(page);
  }

  injectDevToolbar(page, round, pair);
}

function injectDevToolbar(activePage, activeRound = 1, activePair = "bfi_E+bfi_A") {
  const old = document.getElementById("devToolbar");
  if (old) old.remove();

  const basePath = window.location.pathname || "/";

  const pages = [
    { key: "cover", label: "封面" },
    { key: "info", label: "信息" },
    { key: "bfi", label: "问卷" },
    { key: "task", label: "情境" },
    { key: "finish", label: "结果" },
    { key: "poster", label: "海报" },
  ];

  const taskCount = state.config?.scenario_tasks?.length || 6;

  document.body.insertAdjacentHTML("beforeend", `
  <div class="dev-toolbar" id="devToolbar">
    <div class="dev-toolbar-header">
      <strong>DEV 预览</strong>
      <button class="dev-toolbar-toggle" id="devToolbarToggle" type="button">收起</button>
    </div>

    <div class="dev-toolbar-body">
      <div class="dev-toolbar-row">
        ${pages.map((item) => `
          <a class="${activePage === item.key ? "active" : ""}" href="${basePath}?dev=${item.key}">
            ${item.label}
          </a>
        `).join("")}
      </div>

      <div class="dev-toolbar-rounds">
        ${Array.from({ length: taskCount }).map((_, index) => {
          const round = index + 1;
          return `
            <a class="${activePage === "task" && activeRound === round ? "active" : ""}" href="${basePath}?dev=task&round=${round}">
              ${round}
            </a>
          `;
        }).join("")}
      </div>

      <div class="dev-toolbar-pairs">
        <span>海报组合</span>
        ${DEV_POSTER_PAIR_OPTIONS.map((item) => `
          <a class="${activePage === "poster" && activePair === item.key ? "active" : ""}" href="${basePath}?dev=poster&pair=${encodeURIComponent(item.key)}">
            ${item.label}
          </a>
        `).join("")}
      </div>
    </div>
  </div>
`);

  const toolbar = document.getElementById("devToolbar");
  const toggleBtn = document.getElementById("devToolbarToggle");

  if (toolbar && toggleBtn) {
    if (window.innerWidth <= 720) {
      toolbar.classList.add("is-collapsed");
      toggleBtn.innerText = "展开";
    }

    toggleBtn.addEventListener("click", () => {
      const collapsed = toolbar.classList.toggle("is-collapsed");
      toggleBtn.innerText = collapsed ? "展开" : "收起";
    });
  }
}

loadConfig()
  .then(setupDevPreview)
  .catch((err) => alert(`加载配置失败：${err.message}`));
