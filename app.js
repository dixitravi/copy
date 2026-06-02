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
const saveBtn  = document.getElementById("saveBtn");
const copyBtn  = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const status   = document.getElementById("timestamp");

const themeToggle = document.getElementById("themeToggle");

const roomPills = document.getElementById("roomPills");
const addPageBtn = document.getElementById("addPageBtn");

const updateBtn  = document.getElementById("updateBtn");
const refreshBtn = document.getElementById("refreshBtn");

/* MODE */
const textModeBtn  = document.getElementById("textModeBtn");
const imageModeBtn = document.getElementById("imageModeBtn");
const imageModeEl  = document.getElementById("imageMode");

/* IMAGE */
const imageInput   = document.getElementById("imageInput");
const imageGallery = document.getElementById("imageGallery");

/* MODAL */
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
let mode = "text";
let textRooms = ["default"];
let imageRooms = ["default"];
let currentRoom = "default";
let lastServerContent = "";

let pollingInterval = null;
let autosaveTimer = null;

let currentImages = [];

/* =========================================================
   NOTIFICATIONS ✅ FIXED
========================================================= */
function showNotification(message) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(message);
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") new Notification(message);
    });
  }
}

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

/* ✅ FIX: using single backend key */
async function loadRoomsFromServer() {
  try {
    const res = await fetch(`${API_URL}?room=__rooms__`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) && data.length ? data : ["default"];
  } catch {
    return ["default"];
  }
}

async function saveRoomsToServer(rooms) {
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
   SAVE-IF-DIRTY
========================================================= */
async function saveIfDirty() {
  if (mode === "text" && textarea.value !== lastServerContent) {
    await saveRoomToServer(currentRoom, textarea.value);
    lastServerContent = textarea.value;
    updateBtn.classList.add("hidden");
    await refreshStatus(currentRoom);
    showNotification("✅ Text saved");
  }
}

/* =========================================================
   POLLING
========================================================= */
function startPolling() {
  clearInterval(pollingInterval);

  if (mode !== "text") return;

  pollingInterval = setInterval(async () => {
    const data = await loadRoomFromServer(currentRoom);
    const fresh = data.content || "";

    if (fresh !== lastServerContent) {
      if (textarea.value !== fresh) {
        updateBtn.classList.remove("hidden");
      } else {
        lastServerContent = fresh;
      }
    }
  }, 3000);
}

/* =========================================================
   ROOM RENDER ✅ FIXED
========================================================= */
function renderRooms() {
  roomPills.innerHTML = "";

  textRooms.forEach(room => {
    const pill = document.createElement("div");
    pill.className = "pill" + (room === currentRoom ? " active" : "");

    const label = document.createElement("span");
    label.textContent = room;

    label.onclick = () => {
      currentRoom = room;
      mode === "text" ? switchRoom(room) : loadImages(room);
    };

    pill.appendChild(label);
    roomPills.appendChild(pill);
  });
}

/* =========================================================
   TEXT MODE
========================================================= */
async function switchRoom(room) {
  await saveIfDirty();

  textarea.value = "Loading...";
  textarea.disabled = true;

  const data = await loadRoomFromServer(room);

  textarea.value = data.content || "";
  lastServerContent = textarea.value;

  textarea.disabled = false;
  updateBtn.classList.add("hidden");

  renderRooms();
  await refreshStatus(room);
  startPolling();
}

textarea.addEventListener("input", () => {
  if (mode !== "text") return;

  clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(async () => {
    await saveRoomToServer(currentRoom, textarea.value);
    lastServerContent = textarea.value;
    updateBtn.classList.add("hidden");
    await refreshStatus(currentRoom);
    showNotification("✅ Auto-saved");
  }, 2000);
});

/* =========================================================
   IMAGE MODE
========================================================= */
async function loadImages(room) {
  const data = await loadRoomFromServer("image_" + room);

  let imgs = [];
  try {
    imgs = JSON.parse(data.content || "[]");
  } catch {}

  renderImages(imgs);
}

async function saveImages(room, images) {
  await fetch(`${API_URL}?room=image_${encodeURIComponent(room)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "content-update",
      content: JSON.stringify(images),
      updatedBy: CURRENT_USER,
      updatedAt: new Date().toISOString()
    })
  });
}

function renderImages(images) {
  currentImages = images;
  imageGallery.innerHTML = "";

  images.forEach((src, index) => {
    const wrapper = document.createElement("div");

    const img = document.createElement("img");
    img.src = src;

    const remove = document.createElement("button");
    remove.textContent = "×";

    remove.onclick = async () => {
      currentImages.splice(index, 1);
      await saveImages(currentRoom, currentImages);
      renderImages(currentImages);
      showNotification("🖼️ Image removed");
    };

    wrapper.appendChild(img);
    wrapper.appendChild(remove);
    imageGallery.appendChild(wrapper);
  });
}

imageInput.onchange = async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    currentImages.push(reader.result);
    await saveImages(currentRoom, currentImages);
    renderImages(currentImages);
    showNotification("🖼️ Image uploaded & saved");
  };

  reader.readAsDataURL(file);
};

/* =========================================================
   MODE SWITCH
========================================================= */
function setMode(newMode) {
  mode = newMode;

  if (mode === "text") {
    textModeBtn.classList.add("active");
    imageModeBtn.classList.remove("active");

    textarea.classList.remove("hidden");
    imageModeEl.classList.add("hidden");

    currentRoom = textRooms[0];
    renderRooms();
    switchRoom(currentRoom);

  } else {
    imageModeBtn.classList.add("active");
    textModeBtn.classList.remove("active");

    textarea.classList.add("hidden");
    imageModeEl.classList.remove("hidden");

    currentRoom = imageRooms[0];
    renderRooms();
    loadImages(currentRoom);
  }
}

textModeBtn.onclick = () => setMode("text");
imageModeBtn.onclick = () => setMode("image");

/* =========================================================
   ACTIONS
========================================================= */
saveBtn.onclick = async () => {
  await saveIfDirty();
  showNotification("✅ Saved manually");
};

copyBtn.onclick = () =>
  mode === "text" && navigator.clipboard.writeText(textarea.value);

clearBtn.onclick = async () => {
  if (mode === "text") textarea.value = "";
  if (mode === "image") {
    currentImages = [];
    await saveImages(currentRoom, []);
    renderImages([]);
    showNotification("🖼️ Images cleared");
  }
};

/* =========================================================
   MODAL ✅ FIXED ROOM SAVE
========================================================= */
addPageBtn.onclick = () => {
  roomModal.classList.remove("hidden");
};

closeModalBtn.onclick = cancelModal.onclick = () => {
  roomModal.classList.add("hidden");
};

createRoomBtn.onclick = async () => {
  const name = roomNameInput.value.trim();

  if (!name || textRooms.includes(name)) {
    roomError.classList.remove("hidden");
    modalContent.classList.add("shake");
    setTimeout(() => modalContent.classList.remove("shake"), 250);
    return;
  }

  textRooms.push(name);
  imageRooms.push(name);

  await saveRoomsToServer(textRooms); // ✅ FIXED

  currentRoom = name;
  roomModal.classList.add("hidden");

  renderRooms();
  setMode(mode);

  showNotification("✅ New tab created");
};

/* =========================================================
   INIT ✅ FIXED
========================================================= */
(async function init() {
  const rooms = await loadRoomsFromServer();

  textRooms = [...rooms];
  imageRooms = [...rooms];

  setMode("text");
})();
