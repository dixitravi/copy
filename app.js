const body = document.body;
const themeToggle = document.getElementById("themeToggle");

/* Disable transition on first paint */
requestAnimationFrame(() => {
  body.classList.remove("no-theme-transition");
});

/* Restore theme */
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  body.dataset.theme = "light";
  themeToggle.textContent = "🌞";
}

/* Theme toggle */
themeToggle.onclick = () => {
  const isLight = body.dataset.theme === "light";
  body.dataset.theme = isLight ? "" : "light";
  themeToggle.textContent = isLight ? "🌙" : "🌞";
  localStorage.setItem("theme", isLight ? "dark" : "light");
};

/* Elements */
const roomPills = document.getElementById("roomPills");
const roomsContainer = document.getElementById("roomsContainer");
const togglePagesBtn = document.getElementById("togglePagesBtn");
const addPageBtn = document.getElementById("addPageBtn");

const previewToggle = document.getElementById("previewToggle");
const textarea = document.getElementById("pasteBox");
const preview = document.getElementById("preview");
const editor = document.querySelector(".editor");

const roomModal = document.getElementById("roomModal");
const modalContent = document.querySelector(".modal-content");
const roomNameInput = document.getElementById("roomNameInput");
const roomError = document.getElementById("roomError");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModal = document.getElementById("cancelModal");
const createRoomBtn = document.getElementById("createRoomBtn");

/* State */
let rooms = JSON.parse(localStorage.getItem("rooms")) || ["default"];
let currentRoom = rooms[0];
let pagesExpanded = false;

function normalize(name) {
  return name.trim().toLowerCase();
}

function roomExists(name) {
  return rooms.some(r => normalize(r) === normalize(name));
}

/* Render pills */
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

function switchRoom(room) {
  currentRoom = room;
  textarea.value = localStorage.getItem(`room-${room}`) || "";
  renderRooms();
}

/* More / Less */
togglePagesBtn.onclick = () => {
  pagesExpanded = !pagesExpanded;
  roomsContainer.classList.toggle("collapsed", !pagesExpanded);
  togglePagesBtn.textContent = pagesExpanded ? "Less" : "More";
};

/* Preview toggle */
previewToggle.onchange = e => {
  editor.classList.toggle("full", !e.target.checked);
  preview.classList.toggle("hidden", !e.target.checked);
};

/* Modal */
addPageBtn.onclick = () => {
  roomModal.classList.remove("hidden");
  roomNameInput.value = "";
  roomError.classList.add("hidden");
  modalContent.classList.remove("has-error");
  roomNameInput.focus();
};

closeModalBtn.onclick = cancelModal.onclick = () =>
  roomModal.classList.add("hidden");

roomNameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    createRoom();
  }
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

/* Init */
renderRooms();
switchRoom(currentRoom);