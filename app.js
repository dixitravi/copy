/* =========================================================
   CONFIG
========================================================= */
const API_URL = "https://bold-bar-31d0.dixitravi.workers.dev";

/* =========================================================
   USER
========================================================= */
const CURRENT_USER =
  localStorage.getItem("username") ||
  `User (${navigator.platform})`;

/* =========================================================
   ELEMENTS
========================================================= */
const body = document.body;

const textarea = document.getElementById("pasteBox");
const preview  = document.getElementById("preview");
const editor   = document.querySelector(".editor");

const saveBtn  = document.getElementById("saveBtn");
const copyBtn  = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const status   = document.getElementById("timestamp");

const previewToggle = document.getElementById("previewToggle");
const themeToggle   = document.getElementById("themeToggle");

const roomPills      = document.getElementById("roomPills");
const roomsContainer = document.getElementById("roomsContainer");
const togglePagesBtn = document.getElementById("togglePagesBtn");
const addPageBtn     = document.getElementById("addPageBtn");

const updateBtn  = document.getElementById("updateBtn");
const refreshBtn = document.getElementById("refreshBtn");

/* Modal */
const roomModal     = document.getElementById("roomModal");
const modalContent  = document.querySelector(".modal-content");
const roomNameInput = document.getElementById("roomNameInput");
const roomError     = document.getElementById("roomError");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModal   = document.getElementById("cancelModal");
const createRoomBtn = document.getElementById("createRoomBtn");

/* =========================================================
   STATE
========================================================= */
let rooms = ["default"];
let currentRoom = "default";
let pagesExpanded = false;

let lastServerContent = "";
let pollingInterval = null;
let autosaveTimer = null;

/* =========================================================
   THEME
========================================================= */
requestAnimationFrame(() => {
  body.classList.remove("no-theme-transition");
});

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  body.dataset.theme = "light";
  themeToggle.textContent = "🌞";
}

themeToggle.onclick = () => {
  const isLight = body.dataset.theme === "light";
  body.dataset.theme = isLight ? "" : "light";
  themeToggle.textContent = isLight ? "🌙" : "🌞";
  localStorage.setItem("theme", isLight ? "dark" : "light");
};

/* =========================================================
   SERVER HELPERS
========================================================= */
async function loadRoomFromServer(room) {
  const res = await fetch(`${API_URL}?room=${encodeURIComponent(room)}`, {
    cache: "no-store"
  });
  return res.json();
}

async function saveRoomToServer(room, content) {
  await fetch(`${API_URL}?room=${encodeURIComponent(room)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "content-update",
      content,
      updatedBy: CURRENT_USER,
      updatedAt: new Date().toISOString()
    })
  });
}

/* =========================================================
   ROOMS SYNC (AUTHORITATIVE)
========================================================= */
async function loadRoomsFromServer() {
  try {
    const res = await fetch(`${API_URL}?room=__rooms__`, {
      cache: "no-store"
    });
    const serverRooms = await res.json();

    if (Array.isArray(serverRooms) && serverRooms.length) {
      rooms = serverRooms;
      return;
    }

    throw new Error("Invalid rooms");
  } catch {
    // offline fallback only
    rooms = JSON.parse(localStorage.getItem("rooms")) || ["default"];
  }
}

async function saveRoomsToServer() {
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "rooms-update",
      rooms
    })
  });
}

/* =========================================================
   STATUS
========================================================= */
async function refreshStatus(room) {
  const data = await loadRoomFromServer(room);
  if (data.updatedBy && data.updatedAt) {
    status.textContent =
      `Last updated by ${data.updatedBy} at ` +
      new Date(data.updatedAt).toLocaleTimeString();
  }
}

/* =========================================================
   POLLING (PER ROOM)
========================================================= */
function startPolling() {
  clearInterval(pollingInterval);

  pollingInterval = setInterval(async () => {
    const data = await loadRoomFromServer(currentRoom);
    const fresh = data.content || "";

    if (fresh !== lastServerContent) {
      lastServerContent = fresh;
      if (textarea.value !== fresh) {
        updateBtn.classList.remove("hidden");
      }
    }
  }, 3000);
}

/* =========================================================
   RENDER ROOMS (WITH DELETE)
========================================================= */
function renderRooms() {
  roomPills.innerHTML = "";

  rooms.forEach(room => {
    const pill = document.createElement("div");
    pill.className = "pill" + (room === currentRoom ? " active" : "");

    const label = document.createElement("span");
    label.textContent = room;
    label.onclick = () => switchRoom(room);
    pill.appendChild(label);

    if (rooms.length > 1) {
      const remove = document.createElement("span");
      remove.className = "remove";
      remove.textContent = "×";

      remove.onclick = async (e) => {
        e.stopPropagation();
        rooms = rooms.filter(r => r !== room);
        await saveRoomsToServer();

        if (room === currentRoom) {
          switchRoom(rooms[0]);
        } else {
          renderRooms();
        }
      };

      pill.appendChild(remove);
    }

    roomPills.appendChild(pill);
  });

  requestAnimationFrame(() => {
    const maxHeight = 28 * 2 + 8;
    const overflow = roomsContainer.scrollHeight > maxHeight;
    togglePagesBtn.classList.toggle("hidden", !overflow);
    roomsContainer.classList.toggle("collapsed", !pagesExpanded);
    togglePagesBtn.textContent = pagesExpanded ? "Less" : "More";
  });
}

/* =========================================================
   SWITCH ROOM (HARD ISOLATION)
========================================================= */
async function switchRoom(room) {
  clearInterval(pollingInterval);

  currentRoom = room;
  textarea.value = "Loading…";

  const data = await loadRoomFromServer(room);
  textarea.value = data.content || "";
  lastServerContent = textarea.value;

  updateBtn.classList.add("hidden");
  renderRooms();
  await refreshStatus(room);
  startPolling();
}

/* =========================================================
   AUTOSAVE (ROOM-SCOPED)
========================================================= */
textarea.addEventListener("input", () => {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    await saveRoomToServer(currentRoom, textarea.value);
    lastServerContent = textarea.value;
    await refreshStatus(currentRoom);
  }, 2000);
});

/* =========================================================
   UPDATE / REFRESH
========================================================= */
updateBtn.onclick = () => {
  textarea.value = lastServerContent;
  updateBtn.classList.add("hidden");
};

refreshBtn.onclick = async () => {
  const data = await loadRoomFromServer(currentRoom);
  textarea.value = data.content || "";
  lastServerContent = textarea.value;
  updateBtn.classList.add("hidden");
  await refreshStatus(currentRoom);
};

/* =========================================================
   ACTIONS
========================================================= */
saveBtn.onclick = async () => {
  await saveRoomToServer(currentRoom, textarea.value);
  await refreshStatus(currentRoom);
};

copyBtn.onclick = () => navigator.clipboard.writeText(textarea.value);
clearBtn.onclick = () => (textarea.value = "");

/* =========================================================
   PREVIEW
========================================================= */
previewToggle.onchange = e => {
  const on = e.target.checked;
  editor.classList.toggle("full", !on);
  preview.classList.toggle("hidden", !on);
  if (on) preview.innerHTML = textarea.value;
};

/* =========================================================
   PAGE MODAL
========================================================= */
addPageBtn.onclick = () => {
  roomModal.classList.remove("hidden");
  roomNameInput.value = "";
  roomError.classList.add("hidden");
};

closeModalBtn.onclick = cancelModal.onclick = () => {
  roomModal.classList.add("hidden");
};

createRoomBtn.onclick = async () => {
  const name = roomNameInput.value.trim();
  if (!name || rooms.includes(name)) {
    roomError.classList.remove("hidden");
    modalContent.classList.add("shake");
    setTimeout(() => modalContent.classList.remove("shake"), 250);
    return;
  }

  rooms.push(name);
  await saveRoomsToServer();
  roomModal.classList.add("hidden");
  switchRoom(name);
};

/* =========================================================
   INIT
========================================================= */
(async function init() {
  await loadRoomsFromServer();
  currentRoom = rooms[0];
  renderRooms();
  switchRoom(currentRoom);
})();
