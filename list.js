const CARD_LIST_KEY = "bingo-local-cards";
const CARD_PREFIX = "bingo-card-";
const LANG_KEY = "bingo-local-lang";
const LEGACY_KEY = "bingo-local-v1";

const defaultData = {
  title: "",
  cells: Array.from({ length: 25 }, () => ({ text: "", checked: false })),
  theme: {
    bg: "#0b0f19",
    cell: "#1e263a",
    accent: "#6ee7ff",
    text: "#eef2ff",
  },
};

const elements = {
  langToggle: document.getElementById("langToggle"),
  newCardBtn: document.getElementById("newCardBtn"),
  titleText: document.getElementById("titleText"),
  subtitle: document.getElementById("subtitle"),
  listTitle: document.getElementById("listTitle"),
  listCount: document.getElementById("listCount"),
  cardList: document.getElementById("cardList"),
  tipText: document.getElementById("tipText"),
};

let currentLang = loadLang();

function loadLang() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function saveLang() {
  localStorage.setItem(LANG_KEY, currentLang);
}

function loadCardList() {
  const raw = localStorage.getItem(CARD_LIST_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveCardList(list) {
  localStorage.setItem(CARD_LIST_KEY, JSON.stringify(list));
}

function cardStorageKey(id) {
  return `${CARD_PREFIX}${id}`;
}

function migrateLegacyData() {
  const list = loadCardList();
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (!legacyRaw || list.length > 0) return;
  try {
    const legacy = JSON.parse(legacyRaw);
    const newId = crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`;
    localStorage.setItem(cardStorageKey(newId), JSON.stringify(legacy));
    saveCardList([
      {
        id: newId,
        title: typeof legacy?.title === "string" ? legacy.title : "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    localStorage.removeItem(LEGACY_KEY);
  } catch (err) {
    console.warn("Failed to migrate legacy data.");
  }
}

function getCopy() {
  const copy = {
    en: {
      title: "Resolution Bingo",
      subtitle: "Your personal bingo card library",
      listTitle: "Your Cards",
      newCard: "New Card",
      untitled: "Untitled card",
      empty: "No cards yet. Create your first one.",
      open: "Open",
      remove: "Remove",
      tip: "Tip: cards are stored only on this device.",
      count: (n) => `${n} card${n === 1 ? "" : "s"}`,
      confirmRemove: "Remove this card? This cannot be undone.",
    },
    zh: {
      title: "新年目标宾果",
      subtitle: "你的宾果卡片库",
      listTitle: "你的卡片",
      newCard: "新卡片",
      untitled: "未命名卡片",
      empty: "还没有卡片，先创建一张吧。",
      open: "打开",
      remove: "删除",
      tip: "提示：卡片只保存在本设备中。",
      count: (n) => `${n} 张卡片`,
      confirmRemove: "确定删除这张卡片吗？此操作无法撤销。",
    },
  };
  return copy[currentLang];
}

function applyLanguage() {
  const copy = getCopy();
  elements.titleText.textContent = copy.title;
  elements.subtitle.textContent = copy.subtitle;
  elements.listTitle.textContent = copy.listTitle;
  elements.newCardBtn.textContent = copy.newCard;
  elements.tipText.textContent = copy.tip;
  elements.langToggle.textContent = currentLang === "en" ? "中文" : "EN";
  renderList();
}

function renderList() {
  const copy = getCopy();
  const list = loadCardList();
  elements.cardList.innerHTML = "";
  elements.listCount.textContent = copy.count(list.length);

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card-tile";
    empty.innerHTML = `<h3>${copy.empty}</h3>`;
    elements.cardList.appendChild(empty);
    return;
  }

  list
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((card) => {
      const tile = document.createElement("div");
      tile.className = "card-tile";

      const title = document.createElement("h3");
      title.textContent = card.title || copy.untitled;

      const meta = document.createElement("p");
      meta.textContent = new Date(card.updatedAt).toLocaleString();

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const openBtn = document.createElement("a");
      openBtn.className = "ghost";
      openBtn.textContent = copy.open;
      openBtn.href = `card.html?id=${card.id}`;

      const removeBtn = document.createElement("button");
      removeBtn.className = "ghost";
      removeBtn.textContent = copy.remove;
      removeBtn.addEventListener("click", () => removeCard(card.id));

      actions.appendChild(openBtn);
      actions.appendChild(removeBtn);

      tile.appendChild(title);
      tile.appendChild(meta);
      tile.appendChild(actions);

      elements.cardList.appendChild(tile);
    });
}

function removeCard(id) {
  const copy = getCopy();
  if (!confirm(copy.confirmRemove)) return;
  const list = loadCardList();
  const next = list.filter((card) => card.id !== id);
  localStorage.removeItem(cardStorageKey(id));
  saveCardList(next);
  renderList();
}

function createCard() {
  const id = crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`;
  localStorage.setItem(cardStorageKey(id), JSON.stringify(defaultData));
  const now = new Date().toISOString();
  const list = loadCardList();
  list.push({ id, title: "", createdAt: now, updatedAt: now });
  saveCardList(list);
  window.location.href = `card.html?id=${id}`;
}

function bindEvents() {
  elements.langToggle.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "zh" : "en";
    saveLang();
    applyLanguage();
  });

  elements.newCardBtn.addEventListener("click", () => createCard());
}

function init() {
  migrateLegacyData();
  applyLanguage();
  bindEvents();
}

init();
