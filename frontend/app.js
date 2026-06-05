const state = {
  participantId: localStorage.getItem("participant_id") || "",
  config: null,
  bfiAnswers: {},
  bfiScores: null,
  resultPayload: null,
  currentTaskIndex: 0,
  taskAnswers: [],
};

const $ = (id) => document.getElementById(id);

const REFERRAL_STORAGE_KEY = "referrer_participant_id";

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

const SCORE_KEY_TO_PERSONA = {
  bfi_O: "IDEA",
  bfi_C: "DONE",
  bfi_E: "MIC",
  bfi_A: "MOOD",
  bfi_N: "RISK",
};

const POSTER_TITLE = "职场人格画像报告";
const POSTER_EXPORT_WIDTH = 1080;
const POSTER_EXPORT_HEIGHT = 2140;
const MOBILE_POSTER_QUERY = "(max-width: 720px)";

function isMobilePosterViewport() {
  return window.matchMedia?.(MOBILE_POSTER_QUERY).matches || window.innerWidth <= 720;
}

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

function captureReferralParam() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
  }
}

const PUBLIC_INVITE_BASE_URL = "http://139.196.23.47";

function getInviteUrl() {
  const inviteUrl = new URL("/", PUBLIC_INVITE_BASE_URL);

  if (state.participantId) {
    inviteUrl.searchParams.set("ref", state.participantId);
  }

  return inviteUrl.href;
}

function renderInviteQrCode() {
  const qrEl = $("posterQrCode");
  if (!qrEl) return;

  const inviteUrl = getInviteUrl();
  qrEl.innerHTML = "";
  qrEl.setAttribute("data-invite-url", inviteUrl);

  if (typeof QRCode === "undefined") {
    qrEl.innerHTML = `<a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a>`;
    return;
  }

  new QRCode(qrEl, {
    text: inviteUrl,
    width: 148,
    height: 148,
    colorDark: "#172033",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRoundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = null, lineWidth = 1) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败，请稍后重试"));
    img.src = src;
  });
}

function drawImageContain(ctx, img, x, y, width, height) {
  const ratio = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * ratio;
  const drawHeight = img.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const chars = Array.from(String(text || ""));
  const lines = [];
  let line = "";

  chars.forEach((char) => {
    const testLine = `${line}${char}`;
    if (line && ctx.measureText(testLine).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function drawCenteredWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawLeftWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawRadarChart(ctx, items, bounds, options = {}) {
  const {
    gridStroke = "rgba(255, 255, 255, 0.38)",
    gridFill = "rgba(255, 255, 255, 0.05)",
    shapeFill = "rgba(255, 255, 255, 0.28)",
    shapeStroke = "#ffffff",
    pointFill = "#ffffff",
    labelFill = "#ffffff",
    scoreFill = "#ffffff",
    labelFont = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    scoreFont = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  } = options;

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2 + (bounds.centerOffsetY || 0);
  const radius = Math.min(bounds.width, bounds.height) * (bounds.radiusRatio || 0.34);
  const labelRadius = Math.min(bounds.width, bounds.height) * (bounds.labelRadiusRatio || 0.43);
  const startAngle = -Math.PI / 2;

  function getPoint(index, valueRadius) {
    const angle = startAngle + (Math.PI * 2 * index) / items.length;
    return {
      x: centerX + Math.cos(angle) * valueRadius,
      y: centerY + Math.sin(angle) * valueRadius,
    };
  }

  ctx.save();
  ctx.lineWidth = bounds.gridLineWidth || 1;
  ctx.strokeStyle = gridStroke;
  ctx.fillStyle = gridFill;

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
  ctx.fillStyle = shapeFill;
  ctx.strokeStyle = shapeStroke;
  ctx.lineWidth = bounds.shapeLineWidth || 2.5;
  ctx.fill();
  ctx.stroke();

  dataPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, bounds.pointRadius || 4, 0, Math.PI * 2);
    ctx.fillStyle = pointFill;
    ctx.fill();
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  items.forEach((item, index) => {
    const labelPoint = getPoint(index, labelRadius);
    ctx.fillStyle = labelFill;
    ctx.font = labelFont;
    ctx.fillText(item.name, labelPoint.x, labelPoint.y - (bounds.labelGap || 8));
    ctx.fillStyle = scoreFill;
    ctx.font = scoreFont;
    ctx.fillText(`${item.displayScore}分`, labelPoint.x, labelPoint.y + (bounds.scoreGap || 12));
  });

  ctx.restore();
}

async function createQrCanvas(text, size) {
  if (typeof QRCode === "undefined") {
    throw new Error("二维码生成组件未加载，请刷新页面后重试");
  }

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.style.width = `${size}px`;
  holder.style.height = `${size}px`;
  document.body.appendChild(holder);

  new QRCode(holder, {
    text,
    width: size,
    height: size,
    colorDark: "#172033",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });

  await new Promise((resolve) => requestAnimationFrame(resolve));

  const qrCanvas = holder.querySelector("canvas");
  if (qrCanvas) {
    const copy = document.createElement("canvas");
    copy.width = size;
    copy.height = size;
    copy.getContext("2d").drawImage(qrCanvas, 0, 0, size, size);
    holder.remove();
    return copy;
  }

  const qrImg = holder.querySelector("img");
  if (qrImg?.src) {
    const img = await loadImage(qrImg.src);
    const copy = document.createElement("canvas");
    copy.width = size;
    copy.height = size;
    copy.getContext("2d").drawImage(img, 0, 0, size, size);
    holder.remove();
    return copy;
  }

  holder.remove();
  throw new Error("二维码生成失败，请稍后重试");
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("海报生成失败，请稍后重试"));
    }, "image/png", 1);
  });
}

async function buildPosterExportCanvas() {
  const persona = getCurrentPersona();
  const posterScores = getPosterScores();
  const inviteUrl = getInviteUrl();
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_EXPORT_WIDTH;
  canvas.height = POSTER_EXPORT_HEIGHT;

  const ctx = canvas.getContext("2d");
  const personaImage = await loadImage(persona.image);
  const qrCanvas = await createQrCanvas(inviteUrl, 300);

  const bgGradient = ctx.createLinearGradient(0, 0, POSTER_EXPORT_WIDTH, POSTER_EXPORT_HEIGHT);
  bgGradient.addColorStop(0, "#0f766e");
  bgGradient.addColorStop(0.52, "#2563eb");
  bgGradient.addColorStop(1, "#4f46e5");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, POSTER_EXPORT_WIDTH, POSTER_EXPORT_HEIGHT);

  const glowOne = ctx.createRadialGradient(170, 170, 20, 170, 170, 360);
  glowOne.addColorStop(0, "rgba(255,255,255,0.30)");
  glowOne.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glowOne;
  ctx.fillRect(0, 0, POSTER_EXPORT_WIDTH, POSTER_EXPORT_HEIGHT);

  const glowTwo = ctx.createRadialGradient(920, 420, 20, 920, 420, 400);
  glowTwo.addColorStop(0, "rgba(125,211,252,0.24)");
  glowTwo.addColorStop(1, "rgba(125,211,252,0)");
  ctx.fillStyle = glowTwo;
  ctx.fillRect(0, 0, POSTER_EXPORT_WIDTH, POSTER_EXPORT_HEIGHT);

  drawRoundRect(ctx, 48, 48, POSTER_EXPORT_WIDTH - 96, POSTER_EXPORT_HEIGHT - 96, 42, "rgba(255,255,255,0.05)", "rgba(255,255,255,0.18)", 2);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "900 34px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText(POSTER_TITLE, POSTER_EXPORT_WIDTH / 2, 122);

  const imgBox = { x: 318, y: 175, width: 444, height: 554 };
  ctx.save();
  ctx.shadowColor = "rgba(23,32,51,0.26)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 24;
  drawRoundRect(ctx, imgBox.x, imgBox.y, imgBox.width, imgBox.height, 42, "rgba(255,255,255,0.16)", "rgba(255,255,255,0.42)", 2);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, imgBox.x + 12, imgBox.y + 12, imgBox.width - 24, imgBox.height - 24, 34);
  ctx.clip();
  drawImageContain(ctx, personaImage, imgBox.x + 18, imgBox.y + 18, imgBox.width - 36, imgBox.height - 36);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "900 34px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillText(persona.code, POSTER_EXPORT_WIDTH / 2, 800);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 76px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillText(`「${persona.name}」`, POSTER_EXPORT_WIDTH / 2, 892);

  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.font = "600 34px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  drawCenteredWrappedText(ctx, persona.slogan, POSTER_EXPORT_WIDTH / 2, 970, 820, 52, 3);

  const tagY = 1010;
  const tagGap = 18;
  ctx.font = "900 28px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  const tagWidths = persona.tags.map((tag) => Math.ceil(ctx.measureText(tag).width) + 54);
  const totalTagWidth = tagWidths.reduce((sum, width) => sum + width, 0) + tagGap * Math.max(0, tagWidths.length - 1);
  let tagX = (POSTER_EXPORT_WIDTH - totalTagWidth) / 2;
  persona.tags.forEach((tag, index) => {
    const width = tagWidths[index];
    drawRoundRect(ctx, tagX, tagY, width, 54, 27, "rgba(255,255,255,0.15)", "rgba(255,255,255,0.28)", 1.5);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(tag, tagX + width / 2, tagY + 37);
    tagX += width + tagGap;
  });

  const radarPanel = { x: 132, y: 1110, width: POSTER_EXPORT_WIDTH - 264, height: 620 };

drawRoundRect(
  ctx,
  radarPanel.x,
  radarPanel.y,
  radarPanel.width,
  radarPanel.height,
  34,
  "rgba(255,255,255,0.13)",
  "rgba(255,255,255,0.24)",
  1.5
);

// 标题：左中文，右英文
ctx.textAlign = "left";
ctx.fillStyle = "rgba(255,255,255,0.92)";
ctx.font = "900 32px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
ctx.fillText("大五人格雷达图", radarPanel.x + 38, radarPanel.y + 58);

ctx.textAlign = "right";
ctx.fillStyle = "rgba(255,255,255,0.62)";
ctx.font = "800 22px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
ctx.fillText("Big Five Profile", radarPanel.x + radarPanel.width - 38, radarPanel.y + 58);

// 雷达图：居中放大
drawRadarChart(ctx, posterScores, {
  x: radarPanel.x + 38,
  y: radarPanel.y + 82,
  width: radarPanel.width - 76,
  height: radarPanel.height - 112,
  centerOffsetY: 18,
  radiusRatio: 0.40,
  labelRadiusRatio: 0.50,
  pointRadius: 5,
  labelGap: 13,
  scoreGap: 18,
  gridLineWidth: 1.3,
  shapeLineWidth: 4,
}, {
  labelFont: "900 24px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
  scoreFont: "800 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
});

  const bottomY = 1790;
  drawRoundRect(ctx, 78, bottomY, POSTER_EXPORT_WIDTH - 156, 260, 34, "rgba(255,255,255,0.96)", "rgba(216,222,233,0.92)", 2);

  const qrBoxX = 132;
  const qrBoxY = bottomY + 24;
  drawRoundRect(ctx, qrBoxX, qrBoxY, 220, 220, 30, "#ffffff", "rgba(216,222,233,0.96)", 2);
  ctx.drawImage(qrCanvas, qrBoxX + 10, qrBoxY + 10, 200, 200);

  const inviteCopyX = 400;
  const inviteCopyMaxWidth = POSTER_EXPORT_WIDTH - inviteCopyX - 132;
  ctx.textAlign = "left";
  ctx.fillStyle = "#172033";
  ctx.font = "900 36px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  const inviteTitleEndY = drawLeftWrappedText(
    ctx,
    "长按保存，转发给朋友，邀请他们生成自己的专属职场人格画像",
    inviteCopyX,
    bottomY + 72,
    inviteCopyMaxWidth,
    48,
    2,
  );

  ctx.fillStyle = "#667085";
  ctx.font = "700 23px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  drawLeftWrappedText(
    ctx,
    "扫码进入测评首页，从头生成自己的结果",
    inviteCopyX,
    inviteTitleEndY + 18,
    inviteCopyMaxWidth,
    32,
    2,
  );

  canvas.dataset.inviteUrl = inviteUrl;
  return canvas;
}

async function exportPosterImage() {
  const button = $("savePosterBtn");
  const status = $("posterExportStatus");
  const img = $("resultPosterImg");
  const downloadLink = $("posterDownloadLink");
  const poster = $("personalityPoster");

  try {
    if (button) {
      button.disabled = true;
      button.innerText = "正在生成海报...";
    }
    if (status) {
      status.textContent = "正在生成完整海报图片，请稍候。";
      status.classList.remove("error");
    }

    const canvas = await buildPosterExportCanvas();
    const dataUrl = canvas.toDataURL("image/png");
    const inviteUrl = canvas.dataset.inviteUrl || getInviteUrl();

    if (img) {
      img.src = dataUrl;
      img.alt = "完整结果海报，包含人格卡、人格名称、邀请文案和二维码";
      img.setAttribute("data-invite-url", inviteUrl);
      img.classList.remove("hidden");
    }

    if (poster) {
      poster.classList.add("hidden");
    }

    if (downloadLink) {
      downloadLink.href = dataUrl;
      downloadLink.download = `workplace-persona-${state.participantId || "poster"}.png`;
      downloadLink.classList.remove("hidden");
    }

    if (status) {
      status.textContent = "海报已生成。手机端请长按上方完整海报图片保存；电脑端可点击下载。";
    }
  } catch (err) {
    if (status) {
      status.textContent = err.message || "海报生成失败，请稍后重试。";
      status.classList.add("error");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.innerText = "保存结果海报";
    }
  }
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
  state.resultPayload = null;
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
    state.resultPayload = data;
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

function getPercentScoreMap(scores = state.bfiScores || {}) {
  return POSTER_TRAITS.reduce((acc, trait) => {
    acc[trait.key] = toPercentScore(scores[trait.key]);
    return acc;
  }, {});
}

function pickHighestTraitPersona(percentScores) {
  const ranked = Object.entries(SCORE_KEY_TO_PERSONA)
    .map(([key, code], index) => ({
      key,
      code,
      index,
      value: Number.isFinite(percentScores[key]) ? percentScores[key] : -1,
    }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.index - b.index;
    });

  return ranked[0]?.code || "DONE";
}

function selectPersonaCodeFromScores(scores = state.bfiScores || {}) {
  const percentScores = getPercentScoreMap(scores);
  const extraversion = percentScores.bfi_E ?? 0;
  const agreeableness = percentScores.bfi_A ?? 0;
  const conscientiousness = percentScores.bfi_C ?? 0;
  const neuroticism = percentScores.bfi_N ?? 0;
  const openness = percentScores.bfi_O ?? 0;

  if (conscientiousness >= 72 && extraversion >= 55) return "CTRL";
  if (neuroticism >= 68 && conscientiousness >= 48) return "RISK";
  if (extraversion <= 35 && conscientiousness >= 55) return "DIVE";
  if (agreeableness >= 68 && extraversion >= 42) return "GLUE";
  if (extraversion >= 68) return "MIC";
  if (openness >= 68) return "IDEA";
  if (conscientiousness >= 68) return "DONE";
  if (agreeableness >= 62) return "MOOD";

  return pickHighestTraitPersona(percentScores);
}

function getBackendPersonaCode(payload = state.resultPayload || {}) {
  return payload.personaCode || payload.persona_code || payload.persona?.code || "";
}

function getCurrentPersona() {
  const backendCode = getBackendPersonaCode();
  const fallbackCode = selectPersonaCodeFromScores();
  const code = backendCode || fallbackCode;

  return window.getPersonaCard ? window.getPersonaCard(code) : {
    code: "DONE",
    name: "进度条本人",
    image: "",
    slogan: "事情到你手里，就开始稳定地往100%走。",
    tags: ["稳定交付", "靠谱推进", "deadline亲属"],
    accent: "#52677f",
  };
}

function getPersonaTagsHtml(persona, className = "persona-tag") {
  return persona.tags.map((tag) => `
    <span class="${className}">${escapeHtml(tag)}</span>
  `).join("");
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
    posterButton.classList.remove("hidden");
  }
}

function renderPoster({ scroll = true } = {}) {
  const posterSection = $("posterSection");
  if (!posterSection) return;

  const posterScores = getPosterScores();
  const persona = getCurrentPersona();

  posterSection.innerHTML = `
    <article class="poster-card poster-card-v2" id="personalityPoster">
      <div class="poster-glow poster-glow-one"></div>
      <div class="poster-glow poster-glow-two"></div>

      <div class="poster-hero poster-hero-v2">
        <p class="poster-eyebrow">${POSTER_TITLE}</p>
        <div class="poster-persona-figure">
          <img src="${escapeHtml(persona.image)}" alt="${escapeHtml(`${persona.code}｜${persona.name}`)}">
        </div>

        <p class="poster-persona-code">${escapeHtml(persona.code)}</p>
        <h3>「${escapeHtml(persona.name)}」</h3>

        <p class="poster-lead">
          ${escapeHtml(persona.slogan)}
        </p>

        <div class="poster-persona-tags">
          ${getPersonaTagsHtml(persona, "poster-persona-tag")}
        </div>
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

      <div class="poster-bottom poster-bottom-v2">
        <div class="poster-qr-box">
          <div class="poster-qr-code" id="posterQrCode" aria-label="扫码进入测评首页"></div>
        </div>

        <div class="poster-bottom-copy">
          <strong>
          <span class="poster-copy-line">长按保存，转发给朋友</span>
          <span class="poster-copy-line">邀请他们生成自己的专属职场人格画像</span>
        </strong>
      </div>
    </article>
    <img class="result-poster-img poster-main-export-img hidden" id="resultPosterImg" alt="完整结果海报">

    <div class="poster-export-panel">
      <button class="primary poster-save-btn" id="savePosterBtn">保存结果海报</button>
      <p class="poster-export-hint" id="posterExportStatus">
        点击后会把上方海报转换成完整 PNG。手机端长按上方图片保存，电脑端可下载。
      </p>
      <a class="secondary link-btn poster-download-link hidden" id="posterDownloadLink" href="#" download="workplace-persona-poster.png">下载海报 PNG</a>
    </div>
  `;

  posterSection.classList.remove("hidden");

  requestAnimationFrame(() => {
    drawPosterRadar(posterScores);
    renderInviteQrCode();
    $("savePosterBtn")?.addEventListener("click", exportPosterImage);
    if (isMobilePosterViewport()) {
      requestAnimationFrame(() => exportPosterImage());
    }
    if (scroll) {
      posterSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  drawRadarChart(ctx, items, {
    x: 0,
    y: 0,
    width,
    height,
    centerOffsetY: 18,
    radiusRatio: 0.36,
    labelRadiusRatio: 0.43,
  });
}

function drawResultRadar(items) {
  const canvas = $("resultRadar");
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
  const centerY = height / 2 + 8;
  const radius = Math.min(width, height) * 0.34;
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
  ctx.strokeStyle = "rgba(31, 95, 91, 0.22)";
  ctx.fillStyle = "rgba(31, 95, 91, 0.035)";

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
  ctx.fillStyle = "rgba(53, 87, 216, 0.18)";
  ctx.strokeStyle = "#1f5f5b";
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();

  dataPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#3557d8";
    ctx.fill();
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  items.forEach((item, index) => {
    const labelPoint = getPoint(index, labelRadius);
    ctx.fillStyle = "#172033";
    ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(item.name, labelPoint.x, labelPoint.y - 8);
    ctx.fillStyle = "#667085";
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`${item.displayScore}分`, labelPoint.x, labelPoint.y + 12);
  });
}

function renderFinish() {
  clearValidationErrors();
  hidePoster();
  renderBfiReviewPanel("bfiFinishReview");
  renderTaskAnswerReview("taskFinishReview");

  const scoreBox = $("scoreBox");
  if (scoreBox) {
    scoreBox.innerHTML = "";
    scoreBox.classList.add("hidden");
  }

  const finishActions = document.querySelector(".finish-actions");
  if (finishActions) {
    finishActions.classList.add("hidden");
  }

  const posterButton = $("generatePosterBtn");
  if (posterButton) {
    posterButton.classList.add("hidden");
  }

  requestAnimationFrame(() => renderPoster({ scroll: false }));
}

function restart() {
  localStorage.removeItem("participant_id");
  clearValidationErrors();
  hidePoster();

  state.participantId = "";
  state.bfiAnswers = {};
  state.bfiScores = null;
  state.resultPayload = null;
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
  // 8 种正式海报
  { key: "MOOD", label: "MOOD｜读空气" },
  { key: "DONE", label: "DONE｜进度条" },
  { key: "IDEA", label: "IDEA｜点子王" },
  { key: "MIC", label: "MIC｜会议嘴替" },
  { key: "GLUE", label: "GLUE｜调停员" },
  { key: "RISK", label: "RISK｜预言家" },
  { key: "DIVE", label: "DIVE｜潜水员" },
  { key: "CTRL", label: "CTRL｜颗粒度" },

  // 特殊优先级
  { key: "special_all_high", label: "全高→CTRL" },
  { key: "special_ctrl_over_risk", label: "CTRL>RISK" },
  { key: "special_ctrl_over_mic_done", label: "CTRL>MIC/DONE" },
  { key: "special_risk_over_done", label: "RISK>DONE" },
  { key: "special_dive_over_done", label: "DIVE>DONE" },
  { key: "special_glue_over_mic", label: "GLUE>MIC" },
  { key: "special_mic_over_idea", label: "MIC>IDEA" },
  { key: "special_idea_over_done", label: "IDEA>DONE" },

  // fallback
  { key: "fallback_O", label: "开放最高" },
  { key: "fallback_C", label: "尽责最高" },
  { key: "fallback_E", label: "外向最高" },
  { key: "fallback_A", label: "宜人最高" },
  { key: "fallback_N", label: "神经质最高" },

  // 并列
  { key: "tie_all_low", label: "五项低分并列" },
  { key: "tie_OC_low", label: "开放=尽责" },
  { key: "tie_EA_low", label: "外向=宜人" },
  { key: "tie_AN_low", label: "宜人=神经质" },
  { key: "tie_EA_high", label: "高外向=高宜人" },
];

function percentToScore5(percent) {
  return 1 + (percent / 100) * 4;
}

function setDevTraitPercent(scores, key, percent) {
  scores[key] = percentToScore5(percent);
}

function makeDevBfiScores(devCaseKey = "GLUE") {
  const presets = {
    // ===== 8 种正式人格海报 =====

    MOOD: {
      bfi_O: 38,
      bfi_C: 42,
      bfi_E: 40,
      bfi_A: 64,
      bfi_N: 44,
    },

    DONE: {
      bfi_O: 42,
      bfi_C: 70,
      bfi_E: 40,
      bfi_A: 38,
      bfi_N: 44,
    },

    IDEA: {
      bfi_O: 72,
      bfi_C: 42,
      bfi_E: 40,
      bfi_A: 38,
      bfi_N: 44,
    },

    MIC: {
      bfi_O: 40,
      bfi_C: 42,
      bfi_E: 72,
      bfi_A: 38,
      bfi_N: 44,
    },

    GLUE: {
      bfi_O: 40,
      bfi_C: 42,
      bfi_E: 50,
      bfi_A: 72,
      bfi_N: 44,
    },

    RISK: {
      bfi_O: 42,
      bfi_C: 50,
      bfi_E: 40,
      bfi_A: 38,
      bfi_N: 72,
    },

    DIVE: {
      bfi_O: 42,
      bfi_C: 60,
      bfi_E: 30,
      bfi_A: 38,
      bfi_N: 44,
    },

    CTRL: {
      bfi_O: 42,
      bfi_C: 76,
      bfi_E: 60,
      bfi_A: 38,
      bfi_N: 44,
    },

    // ===== 特殊情况：判断优先级 =====

    // 五项都高时，因为 CTRL 判断排第一，所以结果是 CTRL
    special_all_high: {
      bfi_O: 82,
      bfi_C: 82,
      bfi_E: 82,
      bfi_A: 82,
      bfi_N: 82,
    },

    // 同时满足 CTRL 和 RISK 时，CTRL 更优先
    special_ctrl_over_risk: {
      bfi_O: 42,
      bfi_C: 80,
      bfi_E: 60,
      bfi_A: 38,
      bfi_N: 80,
    },

    // 同时满足 CTRL / MIC / DONE 时，CTRL 更优先
    special_ctrl_over_mic_done: {
      bfi_O: 40,
      bfi_C: 80,
      bfi_E: 75,
      bfi_A: 38,
      bfi_N: 44,
    },

    // 同时满足 RISK 和 DONE 时，RISK 更优先
    special_risk_over_done: {
      bfi_O: 40,
      bfi_C: 70,
      bfi_E: 40,
      bfi_A: 38,
      bfi_N: 75,
    },

    // 同时满足 DIVE 和 DONE 时，DIVE 更优先
    special_dive_over_done: {
      bfi_O: 40,
      bfi_C: 70,
      bfi_E: 30,
      bfi_A: 38,
      bfi_N: 44,
    },

    // 同时满足 GLUE 和 MIC 时，GLUE 更优先
    special_glue_over_mic: {
      bfi_O: 40,
      bfi_C: 42,
      bfi_E: 80,
      bfi_A: 80,
      bfi_N: 44,
    },

    // 同时满足 MIC 和 IDEA 时，MIC 更优先
    special_mic_over_idea: {
      bfi_O: 80,
      bfi_C: 42,
      bfi_E: 72,
      bfi_A: 38,
      bfi_N: 44,
    },

    // 同时满足 IDEA 和 DONE 时，IDEA 更优先
    special_idea_over_done: {
      bfi_O: 80,
      bfi_C: 70,
      bfi_E: 40,
      bfi_A: 38,
      bfi_N: 44,
    },

    // ===== fallback：没有命中任何阈值，只看最高项 =====

    fallback_O: {
      bfi_O: 60,
      bfi_C: 56,
      bfi_E: 52,
      bfi_A: 50,
      bfi_N: 48,
    },

    fallback_C: {
      bfi_O: 56,
      bfi_C: 60,
      bfi_E: 40,
      bfi_A: 50,
      bfi_N: 48,
    },

    fallback_E: {
      bfi_O: 56,
      bfi_C: 54,
      bfi_E: 60,
      bfi_A: 50,
      bfi_N: 48,
    },

    fallback_A: {
      bfi_O: 56,
      bfi_C: 54,
      bfi_E: 40,
      bfi_A: 60,
      bfi_N: 48,
    },

    fallback_N: {
      bfi_O: 56,
      bfi_C: 54,
      bfi_E: 40,
      bfi_A: 50,
      bfi_N: 60,
    },

    // ===== 并列情况 =====

    // 五项都 60，没有达到任何阈值，fallback 顺序是 O → C → E → A → N，所以结果是 IDEA
    tie_all_low: {
      bfi_O: 60,
      bfi_C: 60,
      bfi_E: 60,
      bfi_A: 60,
      bfi_N: 60,
    },

    // 开放和尽责并列，没有达到阈值，O 排在 C 前，所以结果是 IDEA
    tie_OC_low: {
      bfi_O: 60,
      bfi_C: 60,
      bfi_E: 50,
      bfi_A: 48,
      bfi_N: 46,
    },

    // 外向和宜人并列低分，没有达到阈值，E 排在 A 前，所以结果是 MIC
    tie_EA_low: {
      bfi_O: 50,
      bfi_C: 48,
      bfi_E: 60,
      bfi_A: 60,
      bfi_N: 46,
    },

    // 宜人和神经质并列低分，没有达到阈值，A 排在 N 前，所以结果是 MOOD
    tie_AN_low: {
      bfi_O: 50,
      bfi_C: 48,
      bfi_E: 46,
      bfi_A: 60,
      bfi_N: 60,
    },

    // 外向和宜人都高时，会先命中 GLUE，而不是 MIC
    tie_EA_high: {
      bfi_O: 40,
      bfi_C: 42,
      bfi_E: 82,
      bfi_A: 82,
      bfi_N: 44,
    },
  };

  const selected = presets[devCaseKey] || presets.GLUE;
  const scores = {};

  Object.entries(selected).forEach(([key, percent]) => {
    setDevTraitPercent(scores, key, percent);
  });

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
  const pair = (params.get("case") || params.get("pair") || "GLUE").replaceAll(" ", "+");

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
  } else {
    showScreen(page);
  }

  injectDevToolbar(page, round, pair);
}

function injectDevToolbar(activePage, activeRound = 1, activePair = "GLUE") {
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
        <span>海报情况</span>
        ${DEV_POSTER_PAIR_OPTIONS.map((item) => `
          <a class="${activePage === "poster" && activePair === item.key ? "active" : ""}" href="${basePath}?dev=poster&case=${encodeURIComponent(item.key)}">
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

captureReferralParam();

loadConfig()
  .then(setupDevPreview)
  .catch((err) => alert(`加载配置失败：${err.message}`));
