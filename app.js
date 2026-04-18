/* =========================================================
   CONFIG – Cloudflare Worker API
========================================================= */
const API_URL = "https://bold-bar-31d0.dixitravi.workers.dev";

/* =========================================================
   USER IDENTIFICATION (simple, replace later if needed)
========================================================= */
const CURRENT_USER =
  localStorage.getItem("username") ||
  `User (${navigator.userAgent.split(" ")[0]})`;

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

const updateBtn = document.getElementById("updateBtn");

/* Modal */
const roomModal       = document.getElementById("roomModal");
const modalContent    = document.querySelector(".modal-content");
const roomNameInput   = document.getElementById("roomNameInput");
const roomError       = document.getElementById("roomError");
const closeModalBtn   = document.getElementById("closeModalBtn");
const cancelModal     = document.getElementById("cancelModal");
const createRoomBtn   = document.getElementById("createRoomBtn");

/* =========================================================
   STATE
========================================================= */
let rooms = JSON.parse(localStorage.getItem("rooms")) || ["default"];
let currentRoom = rooms[0];
let pagesExpanded = false;

let lastKnownContent = "";
let pollingInterval = null;
let autosaveTimer = null;

/* =========================================================
   THEME (animated)
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
  const data = await res.json();

  if (data.updatedBy) {
    const time = new Date(data.updatedAt).toLocaleTimeString();
    status.textContent = `Last updated by ${data.updatedBy} at ${time}`;
  }

  return data.content || "";
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

/* =========================================================
   POLLING (near‑real‑time sync)
========================================================= */
function startPolling() {
  stopPolling();

  pollingInterval = setInterval(async () => {
    const fresh = await loadRoomFromServer(currentRoom);

    if (fresh !== lastKnownContent) {
      if (document.activeElement === textarea) {
        updateBtn.classList.remove("hidden");
      } else {
        textarea.value = fresh;
        lastKnownContent = fresh;
        updateBtn.classList.add("hidden");
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
   RENDER PAGES
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

  const content = await loadRoomFromServer(room);
  textarea.value = content;
  lastKnownContent = content;

  updateBtn.classList.add("hidden");
  renderRooms();
  startPolling();
}

/* =========================================================
   AUTOSAVE (debounced)
========================================================= */
textarea.addEventListener("input", () => {
  updateBtn.classList.add("hidden");

  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    await saveRoomToServer(currentRoom, textarea.value);
    lastKnownContent = textarea.value;
    status.textContent = "Auto‑saved at " + new Date().toLocaleTimeString();
  }, 2000);
});

/* =========================================================
   UPDATE BUTTON
========================================================= */
updateBtn.onclick = async () => {
  const content = await loadRoomFromServer(currentRoom);
  textarea.value = content;
  lastKnownContent = content;
  updateBtn.classList.add("hidden");
};

/* =========================================================
   MANUAL ACTIONS
========================================================= */
saveBtn.onclick = async () => {
  await saveRoomToServer(currentRoom, textarea.value);
  lastKnownContent = textarea.value;
  status.textContent = "Saved at " + new Date().toLocaleTimeString();
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
   INIT
========================================================= */
renderRooms();
switchRoom(currentRoom);
