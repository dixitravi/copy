/* =========================================================
   CONFIG – Cloudflare Worker API
========================================================= */
const API_URL = "https://bold-bar-31d0.dixitravi.workers.dev";

/* =========================================================
   Theme Toggle (Animated + Persistent)
========================================================= */
const body = document.body;
const themeToggle = document.getElementById("themeToggle");

// Prevent animation on first paint
requestAnimationFrame(() => {
  body.classList.remove("no-theme-transition");
});

// Restore saved theme
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
   Elements
========================================================= */
const textarea = document.getElementById("pasteBox");
const preview = document.getElementById("preview");
const editor = document.querySelector(".editor");

const saveBtn = document.getElementById("saveBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const status = document.getElementById("timestamp");

const previewToggle = document.getElementById("previewToggle");

const roomPills = document.getElementById("roomPills");
const roomsContainer = document.getElementById("roomsContainer");
const togglePagesBtn = document.getElementById("togglePagesBtn");
const addPageBtn = document.getElementById("addPageBtn");

/* Modal */
const roomModal = document.getElementById("roomModal");
const modalContent = document.querySelector(".modal-content");
const roomNameInput = document.getElementById("roomNameInput");
const roomError = document.getElementById("roomError");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModal = document.getElementById("cancelModal");
const createRoomBtn = document.getElementById("createRoomBtn");

/* =========================================================
   State
========================================================= */
let rooms = JSON.parse(localStorage.getItem("rooms")) || ["default"];
let currentRoom = rooms[0];
let pagesExpanded = false;

/* Polling state */
let lastKnownContent = "";
let pollingInterval = null;

/* =========================================================
   Helpers
========================================================= */
function normalize(name) {
  return name.trim().toLowerCase();
}

function roomExists(name) {
  return rooms.some(r => normalize(r) === normalize(name));
}

/* =========================================================
   Cloudflare KV API Helpers
========================================================= */
async function loadRoomFromServer(room) {
  try {
    const res = await fetch(
      `${API_URL}?room=${encodeURIComponent(room)}`
    );
    const data = await res.json();
    return data.content || "";
  } catch (err) {
    console.error("Load failed", err);
    return "";
  }
}

async function saveRoomToServer(room, content) {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, content })
    });
  } catch (err) {
    console.error("Save failed", err);
  }
}

/* =========================================================
   Polling (Near-Real-Time Sync)
========================================================= */
function startPolling() {
  stopPolling();

  pollingInterval = setInterval(async () => {
    try {
      const freshContent = await loadRoomFromServer(currentRoom);

      // Update only if content changed and user is NOT typing
      if (
        freshContent !== lastKnownContent &&
        document.activeElement !== textarea
      ) {
        textarea.value = freshContent;
        lastKnownContent = freshContent;
      }
    } catch (err) {
      console.error("Polling failed", err);
    }
  }, 3000); // every 3 seconds
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/* =========================================================
   Render Page Pills
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
      remove.textContent = "×";
      remove.className = "remove";
      remove.onclick = e => {
        e.stopPropagation();
        rooms = rooms.filter(r => r !== room);
        localStorage.setItem("rooms", JSON.stringify(rooms));
        switchRoom(rooms[0]);
      };
      pill.appendChild(remove);
    }

    roomPills.appendChild(pill);
  });

  requestAnimationFrame(() => {
    const maxHeight = 28 * 2 + 8;
    const isOverflowing = roomsContainer.scrollHeight > maxHeight;

    togglePagesBtn.classList.toggle("hidden", !isOverflowing);
    roomsContainer.classList.toggle("collapsed", !pagesExpanded);
    togglePagesBtn.textContent = pagesExpanded ? "Less" : "More";
  });
}

/* =========================================================
   Switch Room (LOAD from KV + start polling)
========================================================= */
async function switchRoom(room) {
  currentRoom = room;
  textarea.value = "Loading…";

  const content = await loadRoomFromServer(room);
  textarea.value = content;
  lastKnownContent = content;

  renderRooms();
  startPolling();
}

/* =========================================================
   More / Less Toggle
========================================================= */
togglePagesBtn.onclick = () => {
  pagesExpanded = !pagesExpanded;
  roomsContainer.classList.toggle("collapsed", !pagesExpanded);
  togglePagesBtn.textContent = pagesExpanded ? "Less" : "More";
};

/* =========================================================
   Save / Copy / Clear
========================================================= */
saveBtn.onclick = async () => {
  saveBtn.disabled = true;
  status.textContent = "Saving…";

  await saveRoomToServer(currentRoom, textarea.value);
  lastKnownContent = textarea.value;

  status.textContent =
    "Saved at " + new Date().toLocaleTimeString();
  saveBtn.disabled = false;
};

copyBtn.onclick = () =>
  navigator.clipboard.writeText(textarea.value);

clearBtn.onclick = () => {
  textarea.value = "";
};

/* =========================================================
   Preview Toggle
========================================================= */
previewToggle.onchange = e => {
  const on = e.target.checked;
  editor.classList.toggle("full", !on);
  preview.classList.toggle("hidden", !on);
  if (on) preview.innerHTML = textarea.value;
};

/* =========================================================
   Modal – Add Page
========================================================= */
addPageBtn.onclick = () => {
  roomModal.classList.remove("hidden");
  roomNameInput.value = "";
  roomError.classList.add("hidden");
  modalContent.classList.remove("has-error");
  roomNameInput.focus();
};

closeModalBtn.onclick =
cancelModal.onclick = () =>
  roomModal.classList.add("hidden");

roomNameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    createRoom();
  }
});

roomNameInput.addEventListener("input", () => {
  roomError.classList.add("hidden");
  modalContent.classList.remove("has-error");
});

createRoomBtn.onclick = createRoom;

function createRoom() {
  const name = roomNameInput.value.trim();
  if (!name) return;

  if (roomExists(name)) {
    roomError.classList.remove("hidden");
    modalContent.classList.add("has-error");

    roomNameInput.classList.remove("shake");
    void roomNameInput.offsetWidth;
    roomNameInput.classList.add("shake");
    return;
  }

  rooms.push(name);
  localStorage.setItem("rooms", JSON.stringify(rooms));
  roomModal.classList.add("hidden");
  switchRoom(name);
}

/* =========================================================
   Init
========================================================= */
renderRooms();
switchRoom(currentRoom);
