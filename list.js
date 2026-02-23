const SUPABASE_URL = "https://ctwcqujtbvfmxrqsgiyf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_E9nh3hcxpfW07DAfvlRjHQ_dkejkMuu";

const LANG_KEY = "bingo-local-lang";
const ROOM_KEY = "bingo-room";

const defaultCardData = {
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
  roomCodeInput: document.getElementById("roomCodeInput"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  roomStatus: document.getElementById("roomStatus"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
  confirmModal: document.getElementById("confirmModal"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmCancel: document.getElementById("confirmCancel"),
  confirmOk: document.getElementById("confirmOk"),
};

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentLang = loadLang();
let currentRoom = loadRoom();
let currentUserId = null;
let roomChannel = null;
let authReady = false;

function loadLang() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function saveLang() {
  localStorage.setItem(LANG_KEY, currentLang);
}

function loadRoom() {
  const raw = localStorage.getItem(ROOM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveRoom(room) {
  if (!room) {
    localStorage.removeItem(ROOM_KEY);
    return;
  }
  localStorage.setItem(ROOM_KEY, JSON.stringify(room));
}

function getCopy() {
  const copy = {
    en: {
      title: "Resolution Bingo",
      subtitle: "Your shared bingo card library",
      listTitle: "Your Cards",
      newCard: "New Card",
      untitled: "Untitled card",
      empty: "No cards yet. Create your first one.",
      open: "Open",
      remove: "Remove",
      tip: "Tip: cards are shared with anyone in the room.",
      count: (n) => `${n} card${n === 1 ? "" : "s"}`,
      confirmRemove: "Remove this card? This cannot be undone.",
      confirmTitle: "Delete card?",
      confirmOk: "Delete",
      confirmCancel: "Cancel",
      join: "Join Room",
      create: "Create Room",
      roomPlaceholder: "Enter room code",
      notInRoom: "Not in a room",
      inRoom: (code) => `Room: ${code}`,
      leave: "Leave",
    },
    zh: {
      title: "新年目标宾果",
      subtitle: "共享的宾果卡片库",
      listTitle: "你的卡片",
      newCard: "新卡片",
      untitled: "未命名卡片",
      empty: "还没有卡片，先创建一张吧。",
      open: "打开",
      remove: "删除",
      tip: "提示：同一房间的成员都能看到这些卡片。",
      count: (n) => `${n} 张卡片`,
      confirmRemove: "确定删除这张卡片吗？此操作无法撤销。",
      confirmTitle: "删除卡片？",
      confirmOk: "删除",
      confirmCancel: "取消",
      join: "加入房间",
      create: "创建房间",
      roomPlaceholder: "输入房间码",
      notInRoom: "尚未加入房间",
      inRoom: (code) => `房间：${code}`,
      leave: "退出",
    },
  };
  return copy[currentLang];
}

async function ensureAuth() {
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    currentUserId = data.user.id;
    authReady = true;
    return;
  }
  const result = await supabase.auth.signInAnonymously();
  if (result.error) {
    throw result.error;
  }
  currentUserId = result.data.user.id;
  authReady = true;
}

function applyLanguage() {
  const copy = getCopy();
  elements.titleText.textContent = copy.title;
  elements.subtitle.textContent = copy.subtitle;
  elements.listTitle.textContent = copy.listTitle;
  elements.newCardBtn.textContent = copy.newCard;
  elements.tipText.textContent = copy.tip;
  elements.langToggle.textContent = currentLang === "en" ? "中文" : "EN";
  elements.joinRoomBtn.textContent = copy.join;
  elements.createRoomBtn.textContent = copy.create;
  elements.roomCodeInput.placeholder = copy.roomPlaceholder;
  elements.leaveRoomBtn.textContent = copy.leave;
  elements.confirmTitle.textContent = copy.confirmTitle;
  elements.confirmOk.textContent = copy.confirmOk;
  elements.confirmCancel.textContent = copy.confirmCancel;
  updateRoomStatus();
}

function updateRoomStatus() {
  const copy = getCopy();
  if (!currentRoom) {
    elements.roomStatus.textContent = copy.notInRoom;
    elements.leaveRoomBtn.hidden = true;
    elements.newCardBtn.disabled = true;
  } else {
    elements.roomStatus.textContent = copy.inRoom(currentRoom.code);
    elements.leaveRoomBtn.hidden = false;
    elements.newCardBtn.disabled = false;
  }
}

function renderList(cards = []) {
  const copy = getCopy();
  elements.cardList.innerHTML = "";
  elements.listCount.textContent = copy.count(cards.length);

  if (cards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card-tile";
    empty.innerHTML = `<h3>${copy.empty}</h3>`;
    elements.cardList.appendChild(empty);
    return;
  }

  cards
    .slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .forEach((card) => {
      const tile = document.createElement("div");
      tile.className = "card-tile";

      const title = document.createElement("h3");
      title.textContent = card.title || copy.untitled;

      const meta = document.createElement("p");
      meta.textContent = new Date(card.updated_at).toLocaleString();

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

async function fetchCards() {
  if (!currentRoom) {
    renderList([]);
    return;
  }
  const { data, error } = await supabase
    .from("cards")
    .select("id,title,updated_at")
    .eq("room_id", currentRoom.id)
    .order("updated_at", { ascending: false });

  if (error) {
    showError(`Failed to load cards: ${error.message}`);
    return;
  }
  renderList(data || []);
}

async function removeCard(id) {
  const ok = await showConfirm(getCopy().confirmRemove);
  if (!ok) return;
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) {
    showError(`Failed to remove card: ${error.message}`);
    return;
  }
  fetchCards();
}

async function createCard() {
  await ensureAuthIfNeeded();
  if (!currentRoom) return;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cards")
    .insert({
      room_id: currentRoom.id,
      owner_id: currentUserId,
      title: "",
      data: defaultCardData,
      updated_at: now,
      updated_by: currentUserId,
    })
    .select("id")
    .single();

  if (error) {
    showError(`Failed to create card: ${error.message}`);
    return;
  }
  fetchCards();
}

async function joinRoomByCode(code) {
  await ensureAuthIfNeeded();
  const { data: room, error } = await supabase.from("rooms").select("id,code").eq("code", code).single();
  if (error || !room) {
    showError("Room not found.");
    return;
  }
  const joinResult = await supabase.from("room_members").upsert({ room_id: room.id, user_id: currentUserId });
  if (joinResult.error) {
    showError(`Failed to join room: ${joinResult.error.message}`);
    return;
  }
  currentRoom = room;
  saveRoom(room);
  await fetchCards();
  subscribeRoom(room.id);
  updateRoomStatus();
}

async function createRoom() {
  await ensureAuthIfNeeded();
  const code = generateRoomCode();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({ code, created_by: currentUserId })
    .select("id,code")
    .single();

  if (error) {
    showError(`Failed to create room: ${error.message}`);
    return;
  }
  const joinResult = await supabase.from("room_members").upsert({ room_id: room.id, user_id: currentUserId });
  if (joinResult.error) {
    showError(`Room created but failed to join: ${joinResult.error.message}`);
    return;
  }
  currentRoom = room;
  saveRoom(room);
  await fetchCards();
  subscribeRoom(room.id);
  updateRoomStatus();
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function subscribeRoom(roomId) {
  if (roomChannel) {
    supabase.removeChannel(roomChannel);
  }
  roomChannel = supabase
    .channel(`room-${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cards", filter: `room_id=eq.${roomId}` },
      () => fetchCards()
    )
    .subscribe();
}

function leaveRoom() {
  currentRoom = null;
  saveRoom(null);
  updateRoomStatus();
  renderList([]);
  if (roomChannel) {
    supabase.removeChannel(roomChannel);
    roomChannel = null;
  }
}

function bindEvents() {
  elements.langToggle.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "zh" : "en";
    saveLang();
    applyLanguage();
  });

  elements.newCardBtn.addEventListener("click", () => {
    createCard().catch(() => {});
  });

  elements.joinRoomBtn.addEventListener("click", () => {
    const code = elements.roomCodeInput.value.trim().toUpperCase();
    if (code) {
      joinRoomByCode(code).catch(() => {});
    }
  });

  elements.createRoomBtn.addEventListener("click", () => {
    createRoom().catch(() => {});
  });

  elements.leaveRoomBtn.addEventListener("click", () => leaveRoom());
}

function showConfirm(message) {
  return new Promise((resolve) => {
    elements.confirmMessage.textContent = message;
    elements.confirmModal.hidden = false;

    const cleanup = (result) => {
      elements.confirmModal.hidden = true;
      elements.confirmCancel.removeEventListener("click", onCancel);
      elements.confirmOk.removeEventListener("click", onOk);
      elements.confirmModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onOk = () => cleanup(true);
    const onBackdrop = (event) => {
      if (event.target === elements.confirmModal) cleanup(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") cleanup(false);
    };

    elements.confirmCancel.addEventListener("click", onCancel);
    elements.confirmOk.addEventListener("click", onOk);
    elements.confirmModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

async function ensureAuthIfNeeded() {
  if (authReady && currentUserId) return;
  try {
    await ensureAuth();
  } catch (error) {
    showError(`Auth failed: ${error.message || "Unknown error"}`);
    throw error;
  }
}

function showError(message) {
  elements.roomStatus.textContent = message;
  alert(message);
}

async function init() {
  applyLanguage();
  bindEvents();
  elements.confirmModal.hidden = true;
  try {
    await ensureAuthIfNeeded();
    if (currentRoom) {
      await fetchCards();
      subscribeRoom(currentRoom.id);
    } else {
      renderList([]);
    }
  } catch (error) {
    renderList([]);
  }
}

init();
