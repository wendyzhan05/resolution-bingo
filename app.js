const STORAGE_KEY = "bingo-local-v1";
const LANG_KEY = "bingo-local-lang";
const GRID_SIZE = 5;

const defaultData = {
  title: "",
  cells: Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({
    text: "",
    checked: false,
  })),
  theme: {
    bg: "#0b0f19",
    cell: "#1e263a",
    accent: "#6ee7ff",
    text: "#eef2ff",
  },
};

const elements = {
  grid: document.getElementById("grid"),
  bingoLines: document.getElementById("bingoLines"),
  fireworks: document.getElementById("fireworks"),
  titleInput: document.getElementById("titleInput"),
  bingoBadge: document.getElementById("bingoBadge"),
  bgColor: document.getElementById("bgColor"),
  cellColor: document.getElementById("cellColor"),
  accentColor: document.getElementById("accentColor"),
  textColor: document.getElementById("textColor"),
  resetBtn: document.getElementById("resetBtn"),
  langToggle: document.getElementById("langToggle"),
  titleText: document.getElementById("titleText"),
  subtitle: document.getElementById("subtitle"),
  labelBg: document.getElementById("labelBg"),
  labelCell: document.getElementById("labelCell"),
  labelAccent: document.getElementById("labelAccent"),
  labelText: document.getElementById("labelText"),
  tipText: document.getElementById("tipText"),
};

let data = loadData();
let audioCtx;
let audioReady = false;
let currentLang = loadLang();
let prevBingoKeys = new Set();

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);
  try {
    const parsed = JSON.parse(raw);
    return normalizeData(parsed);
  } catch (err) {
    console.warn("Failed to load data, resetting.");
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeData(input) {
  const safe = structuredClone(defaultData);
  if (typeof input?.title === "string") safe.title = input.title;

  if (Array.isArray(input?.cells) && input.cells.length === 25) {
    safe.cells = input.cells.map((cell) => ({
      text: typeof cell?.text === "string" ? cell.text : "",
      checked: Boolean(cell?.checked),
    }));
  }

  if (input?.theme) {
    safe.theme.bg = input.theme.bg || safe.theme.bg;
    safe.theme.cell = input.theme.cell || safe.theme.cell;
    safe.theme.accent = input.theme.accent || safe.theme.accent;
    safe.theme.text = input.theme.text || safe.theme.text;
  }

  return safe;
}

function applyTheme() {
  document.documentElement.style.setProperty("--bg", data.theme.bg);
  document.documentElement.style.setProperty("--cell", data.theme.cell);
  document.documentElement.style.setProperty("--accent", data.theme.accent);
  document.documentElement.style.setProperty("--text", data.theme.text);

  elements.bgColor.value = data.theme.bg;
  elements.cellColor.value = data.theme.cell;
  elements.accentColor.value = data.theme.accent;
  elements.textColor.value = data.theme.text;
}

function renderGrid() {
  elements.grid.innerHTML = "";
  data.cells.forEach((cell, index) => {
    const cellEl = document.createElement("div");
    cellEl.className = "cell" + (cell.checked ? " checked" : "");
    cellEl.dataset.index = index.toString();

    const textEl = document.createElement("div");
    textEl.className = "cell-text";
    textEl.textContent = cell.text || getItemPlaceholder(index);
    textEl.dataset.placeholder = cell.text ? "false" : "true";

    const textarea = document.createElement("textarea");
    textarea.className = "cell-edit";
    textarea.value = cell.text;

    textarea.addEventListener("input", (event) => {
      data.cells[index].text = event.target.value;
      textEl.textContent = event.target.value || getItemPlaceholder(index);
      textEl.dataset.placeholder = event.target.value ? "false" : "true";
      saveData();
    });

    textarea.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    cellEl.addEventListener("click", (event) => {
      if (cellEl.classList.contains("editing")) {
        return;
      }
      data.cells[index].checked = !data.cells[index].checked;
      saveData();
      createRipple(cellEl, event);
      playClickSound();
      updateCell(cellEl, index);
      updateBingo();
    });

    cellEl.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      enterEditMode(cellEl, textarea);
    });

    textarea.addEventListener("blur", () => exitEditMode(cellEl, textarea));
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        exitEditMode(cellEl, textarea);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        exitEditMode(cellEl, textarea);
      }
    });

    cellEl.appendChild(textEl);
    cellEl.appendChild(textarea);
    elements.grid.appendChild(cellEl);
  });
}

function updateCell(cellEl, index) {
  cellEl.classList.toggle("checked", data.cells[index].checked);
}

function updateBingo() {
  const results = checkBingo(data.cells.map((cell) => cell.checked));
  const isBingo = results.length > 0;
  elements.bingoBadge.hidden = !isBingo;
  renderBingoLines(results);

  const newKeys = new Set(results.map(lineKey));
  results.forEach((line) => {
    const key = lineKey(line);
    if (!prevBingoKeys.has(key)) {
      launchFireworks(line);
      playBingoSound();
    }
  });
  prevBingoKeys = newKeys;
}

function checkBingo(checked) {
  const lines = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    lines.push({
      type: "row",
      index: row,
      cells: Array.from({ length: GRID_SIZE }, (_, col) => row * GRID_SIZE + col),
    });
  }
  for (let col = 0; col < GRID_SIZE; col++) {
    lines.push({
      type: "col",
      index: col,
      cells: Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + col),
    });
  }
  lines.push({
    type: "diag",
    index: 0,
    cells: Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + i),
  });
  lines.push({
    type: "diag",
    index: 1,
    cells: Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + (GRID_SIZE - 1 - i)),
  });

  return lines.filter((line) => line.cells.every((index) => checked[index]));
}

function bindInputs() {
  elements.titleInput.value = data.title;
  elements.titleInput.addEventListener("input", (event) => {
    data.title = event.target.value;
    saveData();
  });

  document.addEventListener(
    "pointerdown",
    () => {
      if (!audioReady) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioReady = true;
      }
    },
    { once: true }
  );

  elements.bgColor.addEventListener("input", (event) => {
    data.theme.bg = event.target.value;
    applyTheme();
    saveData();
  });

  elements.cellColor.addEventListener("input", (event) => {
    data.theme.cell = event.target.value;
    applyTheme();
    saveData();
  });

  elements.accentColor.addEventListener("input", (event) => {
    data.theme.accent = event.target.value;
    applyTheme();
    saveData();
  });

  elements.textColor.addEventListener("input", (event) => {
    data.theme.text = event.target.value;
    applyTheme();
    saveData();
  });

  elements.resetBtn.addEventListener("click", () => {
    if (!confirm(getCopy().confirmReset)) {
      return;
    }
    data = structuredClone(defaultData);
    saveData();
    applyTheme();
    renderGrid();
    updateBingo();
    elements.titleInput.value = data.title;
  });

  elements.langToggle.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "zh" : "en";
    saveLang();
    applyLanguage();
    renderGrid();
  });
}

function enterEditMode(cellEl, textarea) {
  cellEl.classList.add("editing");
  textarea.style.display = "block";
  textarea.focus();
  textarea.select();
}

function exitEditMode(cellEl, textarea) {
  cellEl.classList.remove("editing");
  textarea.style.display = "none";
}

function renderBingoLines(results) {
  elements.bingoLines.innerHTML = "";
  if (!results.length) return;

  const gridRect = elements.grid.getBoundingClientRect();
  elements.bingoLines.style.width = `${gridRect.width}px`;
  elements.bingoLines.style.height = `${gridRect.height}px`;

  results.forEach((result) => {
    const { start, end, length, angle } = getLineGeometry(result, gridRect);
    if (!start || !end) return;
    const line = document.createElement("div");
    line.className = "bingo-line";
    line.style.width = `${length}px`;
    line.style.left = `${start.x}px`;
    line.style.top = `${start.y - 3}px`;
    line.style.setProperty("--angle", `${angle}deg`);
    elements.bingoLines.appendChild(line);
  });
}

function getLineGeometry(result, gridRect) {
  const startIndex =
    result.type === "row"
      ? result.index * GRID_SIZE
      : result.type === "col"
      ? result.index
      : result.index === 0
      ? 0
      : GRID_SIZE - 1;
  const endIndex =
    result.type === "row"
      ? result.index * GRID_SIZE + (GRID_SIZE - 1)
      : result.type === "col"
      ? result.index + GRID_SIZE * (GRID_SIZE - 1)
      : result.index === 0
      ? GRID_SIZE * GRID_SIZE - 1
      : GRID_SIZE * (GRID_SIZE - 1);

  const startCell = elements.grid.querySelector(`.cell[data-index="${startIndex}"]`);
  const endCell = elements.grid.querySelector(`.cell[data-index="${endIndex}"]`);
  if (!startCell || !endCell) return {};

  const startRect = startCell.getBoundingClientRect();
  const endRect = endCell.getBoundingClientRect();
  const start = {
    x: startRect.left - gridRect.left + startRect.width / 2,
    y: startRect.top - gridRect.top + startRect.height / 2,
  };
  const end = {
    x: endRect.left - gridRect.left + endRect.width / 2,
    y: endRect.top - gridRect.top + endRect.height / 2,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { start, end, length, angle };
}

function lineKey(line) {
  return `${line.type}-${line.index}`;
}

function launchFireworks(line) {
  const canvas = elements.fireworks;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const particles = [];
  const colors = ["#6ee7ff", "#7c5cff", "#38bdf8", "#22d3ee", "#f472b6", "#facc15"];
  const patterns = ["ring", "double", "spray", "star"];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const bursts = 5 + Math.floor(Math.random() * 3);

  for (let i = 0; i < bursts; i++) {
    const originX = width * (0.2 + Math.random() * 0.6);
    const originY = height * (0.2 + Math.random() * 0.4);
    const count = 120 + Math.floor(Math.random() * 60);
    for (let j = 0; j < count; j++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = 1.2 + Math.random() * 3.2;
      if (pattern === "ring") {
        speed = 2.8 + Math.random() * 2.2;
      } else if (pattern === "double") {
        speed = j % 2 === 0 ? 3.8 + Math.random() : 1.6 + Math.random();
      } else if (pattern === "star") {
        angle = (Math.PI * 2 * Math.floor(Math.random() * 6)) / 6 + Math.random() * 0.2;
        speed = 2.5 + Math.random() * 2.8;
      }
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 80 + Math.random() * 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 2.2,
      });
    }
  }

  let frame = 0;
  function tick() {
    frame++;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(11, 15, 25, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life -= 1;
      ctx.globalAlpha = Math.max(p.life / 90, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    if (particles.length > 0 && frame < 220) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }
  requestAnimationFrame(tick);
}

function playBingoSound() {
  if (!audioReady || !audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioReady = true;
  }

  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.14, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  master.connect(audioCtx.destination);

  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 880.0];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + i * 0.12);
    gain.gain.setValueAtTime(0.0001, now + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.22);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.25);
  });
}

function loadLang() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function saveLang() {
  localStorage.setItem(LANG_KEY, currentLang);
}

function getCopy() {
  const copy = {
    en: {
      title: "Resolution Bingo",
      subtitle: "Local-only personal bingo card",
      newCard: "New Card",
      cardTitle: "Card title",
      bingo: "BINGO!",
      labelBg: "Background",
      labelCell: "Cell",
      labelAccent: "Accent",
      labelText: "Text",
      tip: "Tip: click a cell to check it off. Double-click to edit text.",
      confirmReset: "Start a new blank card? This will clear the current one.",
      itemPrefix: "Item",
      toggleLabel: "中文",
    },
    zh: {
      title: "新年目标宾果",
      subtitle: "仅本地保存的个人宾果卡",
      newCard: "新卡片",
      cardTitle: "卡片标题",
      bingo: "宾果！",
      labelBg: "背景",
      labelCell: "格子",
      labelAccent: "高亮",
      labelText: "文字",
      tip: "提示：单击格子勾选，双击编辑文字。",
      confirmReset: "要开始一张新卡吗？这会清空当前内容。",
      itemPrefix: "项目",
      toggleLabel: "EN",
    },
  };
  return copy[currentLang];
}

function getItemPlaceholder(index) {
  const copy = getCopy();
  return `${copy.itemPrefix} ${index + 1}`;
}

function applyLanguage() {
  const copy = getCopy();
  elements.titleText.textContent = copy.title;
  elements.subtitle.textContent = copy.subtitle;
  elements.resetBtn.textContent = copy.newCard;
  elements.titleInput.placeholder = copy.cardTitle;
  elements.bingoBadge.textContent = copy.bingo;
  elements.labelBg.textContent = copy.labelBg;
  elements.labelCell.textContent = copy.labelCell;
  elements.labelAccent.textContent = copy.labelAccent;
  elements.labelText.textContent = copy.labelText;
  elements.tipText.textContent = copy.tip;
  elements.langToggle.textContent = copy.toggleLabel;
}

function createRipple(cellEl, event) {
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const rect = cellEl.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  cellEl.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function playClickSound() {
  if (!audioReady || !audioCtx) return;
  const now = audioCtx.currentTime;
  const duration = 0.18;

  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + duration);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

function init() {
  applyTheme();
  applyLanguage();
  renderGrid();
  updateBingo();
  bindInputs();

  window.addEventListener("resize", () => {
    if (prevBingoKeys.size > 0) {
      const results = checkBingo(data.cells.map((cell) => cell.checked));
      renderBingoLines(results);
    }
  });
}

init();
