/* =========================================================
   CONFIG – Cloudflare Worker API
========================================================= */
const API_URL = "https://bold-bar-31d0.dixitravi.workers.dev";

/* =========================================================
   USER IDENTIFICATION
========================================================= */
const CURRENT_USER =
  localStorage.getItem("username") ||
  `User (${navigator.platform})`;

/* =========================================================
   ELEMENTS
========================================================= */
const body = document.body;

const textarea = document.getElementById("pasteBox");
const preview = document.getElementById("preview");
const editor = document.querySelector(".editor");

const saveBtn   = document.getElementById("saveBtn");
const copyBtn   = document.getElementById("copyBtn");
const clearBtn  = document.getElementById("clearBtn");
const status    = document.getElementById("timestamp");

const previewToggle = document.getElementById("previewToggle");
const themeToggle   = document.getElementById("themeToggle");

const roomPills       = document.getElementById("roomPills");
const roomsContainer  = document.getElementById("roomsContainer");
const togglePagesBtn  = document.getElementById("togglePagesBtn");
const addPageBtn      = document.getElementById("addPageBtn");

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
let rooms = JSON.parse(localStorage.getItem("rooms")) || ["default"];
let currentRoom = rooms[0];
let pagesExpanded = false;

let lastKnownContent  = "";
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
   CLOUD STORAGE HELPERS
========================================================= */
async function loadRoomFromServer(room) {
  const res = await fetch(`${API_URL}?room=${encodeURIComponent(room)}`);
  return res.json();
}

async function saveRoomToServer(room, content) {
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room,
      content,
      updatedBy: CURRENT_USER,
      updatedAt: new Date().toISOString()
    })
  });
}

async function refreshStatus(room) {
  const data = await loadRoomFromServer(room);
  if (data.updatedBy && data.updatedAt) {
    status.textContent =
      `Last updated by ${data.updatedBy} at ` +
      new Date(data.updatedAt).toLocaleTimeString();
  }
}

/* =========================================================
   POLLING (near‑real‑time sync)
========================================================= */
function startPolling() {
  stopPolling();

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

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/* =========================================================
   RENDER ROOMS
========================================================= */
function renderRooms() {
  roomPills.innerHTML = "";

  rooms.forEach(room => {
    const pill = document.createElement("div");
    pill.className = "pill" + (room === currentRoom ? " active" : "");

    /* ---------- Room label ---------- */
    const label = document.createElement("span");
    label.textContent = room;
    label.onclick = () => switchRoom(room);
    pill.appendChild(label);

    /* ---------- Remove button ---------- */
    if (rooms.length > 1) {
      const remove = document.createElement("span");
      remove.className = "remove";
      remove.textContent = "×";

      remove.onclick = (e) => {
        e.stopPropagation();

        const idx = rooms.indexOf(room);
        rooms.splice(idx, 1);
        localStorage.setItem("rooms", JSON.stringify(rooms));

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
   SWITCH ROOM
========================================================= */
async function switchRoom(room) {
  currentRoom = room;
  textarea.value = "Loading…";

  const data = await loadRoomFromServer(room);
  textarea.value = data.content || "";

  lastKnownContent  = textarea.value;
  lastServerContent = textarea.value;

  updateBtn.classList.add("hidden");
  renderRooms();
  await refreshStatus(room);
  startPolling();
}

/* =========================================================
   AUTOSAVE
========================================================= */
textarea.addEventListener("input", () => {
  updateBtn.classList.add("hidden");

  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    await saveRoomToServer(currentRoom, textarea.value);
    lastKnownContent  = textarea.value;
    lastServerContent = textarea.value;
    await refreshStatus(currentRoom);
  }, 2000);
});

/* =========================================================
   UPDATE AVAILABLE BUTTON
========================================================= */
updateBtn.onclick = () => {
  textarea.value = lastServerContent;
  lastKnownContent = lastServerContent;
  updateBtn.classList.add("hidden");
};

/* =========================================================
   REFRESH BUTTON
========================================================= */
refreshBtn.onclick = async () => {
  const data = await loadRoomFromServer(currentRoom);
  textarea.value = data.content || "";

  lastKnownContent  = textarea.value;
  lastServerContent = textarea.value;

  updateBtn.classList.add("hidden");
  await refreshStatus(currentRoom);
};

/* =========================================================
   MANUAL ACTIONS
========================================================= */
saveBtn.onclick = async () => {
  await saveRoomToServer(currentRoom, textarea.value);
  lastKnownContent  = textarea.value;
  lastServerContent = textarea.value;
  await refreshStatus(currentRoom);
};

copyBtn.onclick = () => navigator.clipboard.writeText(textarea.value);
clearBtn.onclick = () => (textarea.value = "");

/* =========================================================
   PREVIEW TOGGLE
========================================================= */
previewToggle.onchange = e => {
  const on = e.target.checked;
  editor.classList.toggle("full", !on);
  preview.classList.toggle("hidden", !on);
  if (on) preview.innerHTML = textarea.value;
};

/* =========================================================
   PAGE MODAL (UNCHANGED)
========================================================= */
addPageBtn.onclick = () => {
  roomModal.classList.remove("hidden");
  roomNameInput.value = "";
  roomError.classList.add("hidden");
};

closeModalBtn.onclick = cancelModal.onclick = () => {
  roomModal.classList.add("hidden");
};

createRoomBtn.onclick = () => {
  const name = roomNameInput.value.trim();
  if (!name || rooms.includes(name)) {
    roomError.classList.remove("hidden");
    modalContent.classList.add("shake");
    setTimeout(() => modalContent.classList.remove("shake"), 250);
    return;
  }

  rooms.push(name);
  localStorage.setItem("rooms", JSON.stringify(rooms));
  roomModal.classList.add("hidden");
  switchRoom(name);
};

/* =========================================================
   INIT
========================================================= */
renderRooms();
switchRoom(currentRoom);
