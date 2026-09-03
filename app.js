// Uploads go to Shared Music only; users add them to playlists manually.
const { createClient } = window.supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const audio = document.querySelector("#audio");
const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const authForm = document.querySelector("#authForm");
const authSubmit = document.querySelector("#authSubmit");
const toggleAuth = document.querySelector("#toggleAuth");
const authMessage = document.querySelector("#authMessage");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const addMusic = document.querySelector("#addMusic");
const fileInput = document.querySelector("#fileInput");
const logout = document.querySelector("#logout");
const newPlaylist = document.querySelector("#newPlaylist");
const renamePlaylist = document.querySelector("#renamePlaylist");
const deletePlaylist = document.querySelector("#deletePlaylist");
const playlistList = document.querySelector("#playlistList");
const playlistCount = document.querySelector("#playlistCount");
const songName = document.querySelector("#songName");
const currentTime = document.querySelector("#currentTime");
const duration = document.querySelector("#duration");
const progress = document.querySelector("#progress");
const playPause = document.querySelector("#playPause");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const shuffle = document.querySelector("#shuffle");
const repeat = document.querySelector("#repeat");
const sleepTimer = document.querySelector("#sleepTimer");
const sleepTimerStatus = document.querySelector("#sleepTimerStatus");
const library = document.querySelector("#library");
const sharedLibrary = document.querySelector("#sharedLibrary");
const libraryTitle = document.querySelector("#libraryTitle");
const songCount = document.querySelector("#songCount");
const sharedCount = document.querySelector("#sharedCount");
const sharedSearch = document.querySelector("#sharedSearch");
const status = document.querySelector("#status");
const queueToggle = document.querySelector("#queueToggle");
const queueSection = document.querySelector("#queueSection");
const queueLibrary = document.querySelector("#queueLibrary");
const queueCount = document.querySelector("#queueCount");
const clearQueue = document.querySelector("#clearQueue");
const sharedSort = document.querySelector("#sharedSort");
const playlistSort = document.querySelector("#playlistSort");
const playerFavorite = document.querySelector("#playerFavorite");
const playerSubtitle = document.querySelector("#playerSubtitle");
const playbackStatus = document.querySelector("#playbackStatus");
const playerQueue = document.querySelector("#playerQueue");
const playerTimer = document.querySelector("#playerTimer");
const settingsBtn = document.querySelector("#settingsBtn");
const settingsModal = document.querySelector("#settingsModal");
const closeSettings = document.querySelector("#closeSettings");
const saveSettings = document.querySelector("#saveSettings");
const settingsEmail = document.querySelector("#settingsEmail");
const defaultPlaylistSelect = document.querySelector("#defaultPlaylistSelect");
const defaultVolume = document.querySelector("#defaultVolume");
const defaultShuffle = document.querySelector("#defaultShuffle");
const defaultRepeatAll = document.querySelector("#defaultRepeatAll");
const newPassword = document.querySelector("#newPassword");
const changePasswordBtn = document.querySelector("#changePasswordBtn");
const clearRecentlyBtn = document.querySelector("#clearRecentlyBtn");
const clearQueueBtnSettings = document.querySelector("#clearQueueBtnSettings");
const resetPlayerBtn = document.querySelector("#resetPlayerBtn");
const settingsMessage = document.querySelector("#settingsMessage");

const BUCKET = "music";
let isSignup = false;
let user = null;
let playlists = [];
let currentPlaylist = null;
let songs = [];
let sharedSongs = [];
let currentSong = -1;
let shuffleOn = false;
let shufflePlayed = new Set();
let repeatMode = "off"; // off, all, one
let sleepTimerId = null;
let sleepTimerEndAt = null;
let sleepEndOfSong = false;
let favoriteSongIds = new Set();
let recentlyPlayed = [];
let viewMode = "playlist";
let sharedSortMode = "newest";
let playlistSortMode = "added";
const RECENT_LIMIT = 20;
const QUEUE_LIMIT = 50;
let queue = [];
let queueOpen = false;
let queueResumeIndex = -1;
let currentPlayingSong = null;
let currentPlaybackSource = "playlist";
let restoredPositionPending = null;
const PLAYER_STATE_VERSION = 2;
let restoringPlayerState = false;
let lastPlayerStateSaveAt = 0;
let accountSettings = {
  defaultPlaylistId: null,
  defaultVolume: 1,
  defaultShuffle: false,
  defaultRepeat: "off"
};


function settingsStorageKey() {
  return user ? `mymusic_settings_${user.id}` : null;
}

function loadAccountSettings() {
  accountSettings = {
    defaultPlaylistId: null,
    defaultVolume: 1,
    defaultShuffle: false,
    defaultRepeat: "off"
  };
  const key = settingsStorageKey();
  if (!key) return;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && typeof saved === "object") {
      accountSettings.defaultPlaylistId = saved.defaultPlaylistId || null;
      accountSettings.defaultVolume = Number.isFinite(Number(saved.defaultVolume))
        ? Math.max(0, Math.min(1, Number(saved.defaultVolume))) : 1;
      accountSettings.defaultShuffle = !!saved.defaultShuffle;
      accountSettings.defaultRepeat = ["off", "all", "one"].includes(saved.defaultRepeat)
        ? saved.defaultRepeat : "off";
    }
  } catch {}
}

function saveAccountSettings() {
  const key = settingsStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(accountSettings));
  } catch {}
}

function applyDefaultPlayerSettings() {
  if (volumeControl && !restoringPlayerState) {
    audio.volume = accountSettings.defaultVolume;
    audio.muted = accountSettings.defaultVolume === 0;
    volumeControl.value = String(audio.volume);
  }
  shuffleOn = !!accountSettings.defaultShuffle;
  repeatMode = accountSettings.defaultRepeat;
  if (shuffle) {
    shuffle.textContent = shuffleOn ? "Shuffle: On" : "Shuffle: Off";
    shuffle.setAttribute("aria-pressed", String(shuffleOn));
  }
  updateRepeatButton();
  updateMuteButton();
}

function populateSettingsForm() {
  if (!settingsModal) return;
  if (settingsEmail) settingsEmail.textContent = user?.email || "Not signed in";

  if (defaultPlaylistSelect) {
    defaultPlaylistSelect.innerHTML = playlists.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)}${isFavoritesPlaylist(p) ? " (Favorites)" : ""}</option>`
    ).join("");
    if (accountSettings.defaultPlaylistId && playlists.some(p => p.id === accountSettings.defaultPlaylistId)) {
      defaultPlaylistSelect.value = accountSettings.defaultPlaylistId;
    } else if (currentPlaylist?.id) {
      defaultPlaylistSelect.value = currentPlaylist.id;
    }
  }

  if (defaultVolume) defaultVolume.value = String(accountSettings.defaultVolume);
  if (defaultShuffle) defaultShuffle.checked = !!accountSettings.defaultShuffle;
  if (defaultRepeatAll) defaultRepeatAll.checked = accountSettings.defaultRepeat === "all";
  if (newPassword) newPassword.value = "";
  if (settingsMessage) settingsMessage.textContent = "";
}

function openSettingsModal() {
  if (!user || !settingsModal) return;
  populateSettingsForm();
  settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  settingsModal?.classList.add("hidden");
  if (settingsMessage) settingsMessage.textContent = "";
}

async function clearRecentlyPlayedFromSettings() {
  recentlyPlayed = [];
  saveRecentlyPlayed();
  if (viewMode === "recent") showRecentlyPlayed();
  renderRecentlyPlayed();
  setStatus("Recently Played cleared.");
}

function resetPlayerSettings() {
  const key = playerStateStorageKey();
  if (key) {
    try { localStorage.removeItem(key); } catch {}
  }
  accountSettings.defaultVolume = 1;
  accountSettings.defaultShuffle = false;
  accountSettings.defaultRepeat = "off";
  saveAccountSettings();
  shuffleOn = false;
  repeatMode = "off";
  if (volumeControl) volumeControl.value = "1";
  audio.volume = 1;
  audio.muted = false;
  updateMuteButton();
  if (shuffle) {
    shuffle.textContent = "Shuffle: Off";
    shuffle.setAttribute("aria-pressed", "false");
  }
  updateRepeatButton();
  savePlayerState();
  populateSettingsForm();
  if (settingsMessage) settingsMessage.textContent = "Player settings reset.";
}

settingsBtn?.addEventListener("click", openSettingsModal);
closeSettings?.addEventListener("click", closeSettingsModal);
settingsModal?.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettingsModal();
});

saveSettings?.addEventListener("click", async () => {
  if (!user) return;
  accountSettings.defaultPlaylistId = defaultPlaylistSelect?.value || currentPlaylist?.id || null;
  accountSettings.defaultVolume = Math.max(0, Math.min(1, Number(defaultVolume?.value || 1)));
  accountSettings.defaultShuffle = !!defaultShuffle?.checked;
  accountSettings.defaultRepeat = defaultRepeatAll?.checked ? "all" : "off";
  saveAccountSettings();

  const playlistTarget = playlists.find(p => p.id === accountSettings.defaultPlaylistId);
  if (playlistTarget && currentPlaylist?.id !== playlistTarget.id) {
    await selectPlaylist(playlistTarget.id);
  }

  audio.volume = accountSettings.defaultVolume;
  audio.muted = accountSettings.defaultVolume === 0;
  if (volumeControl) volumeControl.value = String(accountSettings.defaultVolume);
  shuffleOn = accountSettings.defaultShuffle;
  repeatMode = accountSettings.defaultRepeat;
  if (shuffle) {
    shuffle.textContent = shuffleOn ? "Shuffle: On" : "Shuffle: Off";
    shuffle.setAttribute("aria-pressed", String(shuffleOn));
  }
  updateRepeatButton();
  updateMuteButton();
  savePlayerState();

  const pw = newPassword?.value || "";
  if (pw) {
    if (pw.length < 6) {
      if (settingsMessage) settingsMessage.textContent = "Password must be at least 6 characters.";
      return;
    }
    changePasswordBtn.disabled = true;
    const { error } = await db.auth.updateUser({ password: pw });
    changePasswordBtn.disabled = false;
    if (error) {
      if (settingsMessage) settingsMessage.textContent = `Password change failed: ${error.message}`;
      return;
    }
    newPassword.value = "";
    if (settingsMessage) settingsMessage.textContent = "Settings saved and password changed.";
  } else if (settingsMessage) {
    settingsMessage.textContent = "Settings saved.";
  }
  showToast("Settings saved.");
});

changePasswordBtn?.addEventListener("click", async () => {
  if (!user) return;
  const pw = newPassword?.value || "";
  if (pw.length < 6) {
    if (settingsMessage) settingsMessage.textContent = "Enter a new password with at least 6 characters.";
    return;
  }
  changePasswordBtn.disabled = true;
  const { error } = await db.auth.updateUser({ password: pw });
  changePasswordBtn.disabled = false;
  if (error) {
    if (settingsMessage) settingsMessage.textContent = `Password change failed: ${error.message}`;
    return;
  }
  newPassword.value = "";
  if (settingsMessage) settingsMessage.textContent = "Password changed successfully.";
  showToast("Password changed.");
});

clearRecentlyBtn?.addEventListener("click", async () => {
  if (!confirm("Clear your Recently Played history?")) return;
  await clearRecentlyPlayedFromSettings();
});

clearQueueBtnSettings?.addEventListener("click", () => {
  if (!queue.length) {
    if (settingsMessage) settingsMessage.textContent = "Queue is already empty.";
    return;
  }
  queue = [];
  saveQueue();
  renderQueue();
  savePlayerState();
  if (settingsMessage) settingsMessage.textContent = "Queue cleared.";
});

resetPlayerBtn?.addEventListener("click", () => {
  if (!confirm("Reset your saved player settings?")) return;
  resetPlayerSettings();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal && !settingsModal.classList.contains("hidden")) {
    closeSettingsModal();
  }
});

let songMenu = null;
let songMenuSong = null;

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

function ensureSongMenu() {
  if (songMenu) return;
  songMenu = document.createElement("div");
  songMenu.id = "songMenu";
  songMenu.className = "song-menu hidden";
  songMenu.innerHTML = `
    <button type="button" data-action="play-next">▶ Play next</button>
    <button type="button" data-action="queue">＋ Add to queue</button>
    <button type="button" data-action="playlist">＋ Add to playlist</button>
    <button type="button" data-action="favorite">♡ Add to Favorites</button>
    <button type="button" data-action="delete-owned">🗑 Delete from website</button>`;
  document.body.appendChild(songMenu);

  songMenu.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !songMenuSong) return;
    const song = songMenuSong;
    const action = button.dataset.action;
    closeSongMenu();

    if (action === "play-next") {
      if (!song?.id || !song.storage_path) return;
      if (queue.some(item => item.id === song.id)) {
        queue = [song, ...queue.filter(item => item.id !== song.id)].slice(0, QUEUE_LIMIT);
      } else {
        if (queue.length >= QUEUE_LIMIT) {
          setStatus(`Queue is full (${QUEUE_LIMIT} songs).`);
          return;
        }
        queue.unshift({ ...song, title: cleanSongTitle(song.title) });
      }
      saveQueue();
      queueOpen = true;
      renderQueue();
      setStatus(`"${cleanSongTitle(song.title)}" will play next.`);
      showToast(`"${cleanSongTitle(song.title)}" is up next.`);
      return;
    }

    if (action === "queue") {
      addToQueue(song);
      return;
    }

    if (action === "favorite") {
      await toggleFavorite(song);
      return;
    }

    if (action === "delete-owned") {
      await deleteOwnedSong(song);
      return;
    }

    if (action === "playlist") {
      openAddToPlaylistModal(song);
    }
  });

  document.addEventListener("click", (event) => {
    if (!songMenu || songMenu.classList.contains("hidden")) return;
    if (!event.target.closest("#songMenu") && !event.target.closest(".song-more")) closeSongMenu();
  });

  window.addEventListener("resize", closeSongMenu);
  window.addEventListener("scroll", closeSongMenu, true);
}

function openSongMenu(button, song) {
  ensureSongMenu();
  songMenuSong = { ...song, title: cleanSongTitle(song.title) };
  const favoriteAction = songMenu.querySelector('[data-action="favorite"]');
  if (favoriteAction) {
    const favorite = favoriteSongIds.has(song.id);
    favoriteAction.textContent = favorite ? "♥ Remove from Favorites" : "♡ Add to Favorites";
  }
  const deleteAction = songMenu.querySelector('[data-action="delete-owned"]');
  if (deleteAction) {
    const isOwner = !!user && song.uploaded_by === user.id;
    deleteAction.classList.toggle("hidden", !isOwner);
    deleteAction.disabled = !isOwner;
  }
  const rect = button.getBoundingClientRect();
  const menuWidth = 220;
  let left = rect.right - menuWidth;
  let top = rect.bottom + 7;
  if (left < 10) left = 10;
  if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
  if (top + 190 > window.innerHeight - 10) top = Math.max(10, rect.top - 197);
  songMenu.style.left = `${left}px`;
  songMenu.style.top = `${top}px`;
  songMenu.classList.remove("hidden");
}

function closeSongMenu() {
  if (!songMenu) return;
  songMenu.classList.add("hidden");
  songMenuSong = null;
}

function songMoreButtonMarkup(song) {
  return `<button type="button" class="song-more" title="More actions" aria-label="More actions for ${escapeHtml(cleanSongTitle(song.title))}">⋯</button>`;
}

function openAddToPlaylistModal(song) {
  const modal = document.querySelector("#addToPlaylistModal");
  const select = document.querySelector("#addToPlaylistSelect");
  const confirm = document.querySelector("#confirmAddToPlaylist");
  const cancel = document.querySelector("#cancelAddToPlaylist");
  if (!modal || !select || !confirm || !cancel) return;

  const available = playlists.filter(p => !isFavoritesPlaylist(p));
  if (!available.length) {
    setStatus("Create a playlist first.");
    return;
  }

  select.innerHTML = available.map(p =>
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
  ).join("");
  modal.dataset.songId = song.id;
  modal.dataset.songTitle = cleanSongTitle(song.title);
  modal.classList.remove("hidden");

  const close = () => {
    modal.classList.add("hidden");
    delete modal.dataset.songId;
  };

  cancel.onclick = close;
  confirm.onclick = async () => {
    const playlistId = select.value;
    if (!playlistId || !modal.dataset.songId) return;
    const { error } = await db.from("playlist_songs").insert({
      playlist_id: playlistId,
      song_id: modal.dataset.songId
    });
    if (error) {
      if (error.code === "23505") {
        setStatus("That song is already in this playlist.");
      } else {
        setStatus(error.message);
      }
      close();
      return;
    }
    const target = playlists.find(p => p.id === playlistId);
    setStatus(`Added "${modal.dataset.songTitle}" to ${target?.name || "playlist"}.`);
    close();
    if (currentPlaylist?.id === playlistId) await loadSongs();
  };
  modal.onclick = (event) => {
    if (event.target === modal) close();
  };
}

function formatTime(s) {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function cleanSongTitle(value) {
  let title = String(value || "").trim();

  // Remove common download-site suffixes from song names, including
  // "_spotdown.org", "-spotdown.org", and variants with extra spaces.
  title = title.replace(/\s*[_-]?\s*spotdown\.org\s*$/i, "");

  return title.trim() || String(value || "").trim();
}


function playerStateStorageKey() {
  return user ? `mymusic_player_state_${user.id}` : null;
}

function savePlayerState() {
  const key = playerStateStorageKey();
  if (!key || restoringPlayerState) return;

  const state = {
    version: PLAYER_STATE_VERSION,
    playlistId: currentPlaylist?.id || null,
    songId: currentPlayingSong?.id || (currentSong >= 0 ? songs[currentSong]?.id : null),
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    volume: Number.isFinite(audio.volume) ? audio.volume : 1,
    muted: !!audio.muted,
    shuffleOn: !!shuffleOn,
    repeatMode,
    sleepTimerEndAt: sleepTimerEndAt || null,
    sleepEndOfSong: !!sleepEndOfSong,
    queueOpen: !!queueOpen,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(key, JSON.stringify(state));
    lastPlayerStateSaveAt = Date.now();
  } catch {}
}

function loadPlayerState() {
  const key = playerStateStorageKey();
  if (!key) return null;

  try {
    const state = JSON.parse(localStorage.getItem(key) || "null");
    if (!state || state.version !== PLAYER_STATE_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}

function clearPlayerState() {
  const key = playerStateStorageKey();
  if (!key) return;
  try { localStorage.removeItem(key); } catch {}
}

async function restorePlayerState() {
  const state = loadPlayerState();
  if (!state) {
    applyDefaultPlayerSettings();
    renderQueue();
    return;
  }

  restoringPlayerState = true;
  try {
    shuffleOn = !!state.shuffleOn;
    repeatMode = ["off", "all", "one"].includes(state.repeatMode) ? state.repeatMode : "off";
    queueOpen = !!state.queueOpen;

    if (volumeControl && Number.isFinite(Number(state.volume))) {
      audio.volume = Math.max(0, Math.min(1, Number(state.volume)));
      volumeControl.value = String(audio.volume);
    }
    audio.muted = !!state.muted;
    updateMuteButton();
    shuffle.textContent = shuffleOn ? "Shuffle: On" : "Shuffle: Off";
    shuffle.setAttribute("aria-pressed", String(shuffleOn));
    updateRepeatButton();
    renderQueue();

    if (state.sleepTimerEndAt && Number(state.sleepTimerEndAt) > Date.now()) {
      sleepTimerEndAt = Number(state.sleepTimerEndAt);
      sleepTimerId = setTimeout(() => {
        audio.pause();
        clearSleepTimer();
        setStatus("Sleep timer ended.");
        savePlayerState();
      }, Math.max(0, sleepTimerEndAt - Date.now()));
      if (sleepTimerStatus) sleepTimerStatus.textContent = "Timer restored";
    } else if (state.sleepEndOfSong) {
      sleepEndOfSong = true;
      if (sleepTimerStatus) sleepTimerStatus.textContent = "Stops after this song";
    } else {
      clearSleepTimer();
    }

    if (state.playlistId) {
      const exists = playlists.find(p => p.id === state.playlistId);
      if (exists && !isFavoritesPlaylist(exists)) {
        await selectPlaylist(state.playlistId);
      }
    }

    if (state.songId) {
      const index = songs.findIndex(song => song.id === state.songId);
      if (index >= 0) {
        await loadSong(index, {
          autoplay: false,
          remember: false,
          source: isFavoritesPlaylist(currentPlaylist) ? "favorite" : "playlist",
          resumeAt: Number(state.currentTime || 0)
        });
        const maxTime = Number.isFinite(audio.duration) ? audio.duration : Number(songs[index].duration || 0);
        if (Number.isFinite(Number(state.currentTime)) && maxTime > 0) {
          audio.currentTime = Math.max(0, Math.min(Number(state.currentTime), maxTime));
          progress.value = (audio.currentTime / maxTime) * 100;
          currentTime.textContent = formatTime(audio.currentTime);
        }
      }
    }
  } finally {
    restoringPlayerState = false;
    savePlayerState();
  }
}

function recentStorageKey() {
  return user ? `mymusic_recently_played_${user.id}` : null;
}

function loadRecentlyPlayed() {
  recentlyPlayed = [];
  const key = recentStorageKey();
  if (!key) return;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(saved)) {
      recentlyPlayed = saved
        .filter(song => song && song.id && song.storage_path)
        .map(song => ({ ...song, title: cleanSongTitle(song.title) }))
        .slice(0, RECENT_LIMIT);
    }
  } catch {
    recentlyPlayed = [];
  }
}

function saveRecentlyPlayed() {
  const key = recentStorageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(recentlyPlayed.slice(0, RECENT_LIMIT)));
}

function queueStorageKey() {
  return user ? `mymusic_queue_${user.id}` : null;
}

function loadQueue() {
  queue = [];
  const key = queueStorageKey();
  if (!key) return;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(saved)) {
      queue = saved
        .filter(song => song && song.id && song.storage_path)
        .map(song => ({ ...song, title: cleanSongTitle(song.title) }))
        .slice(0, QUEUE_LIMIT);
    }
  } catch {
    queue = [];
  }
}

function saveQueue() {
  const key = queueStorageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(queue.slice(0, QUEUE_LIMIT)));
}

function renderQueue() {
  if (!queueLibrary || !queueSection) return;
  queueLibrary.innerHTML = "";
  const count = queue.length;
  if (queueCount) queueCount.textContent = `${count} ${count === 1 ? "song" : "songs"}`;
  if (queueToggle) {
    queueToggle.textContent = `Queue: ${count}`;
    queueToggle.classList.toggle("active", queueOpen);
    queueToggle.setAttribute("aria-pressed", String(queueOpen));
  }
  queueSection.classList.toggle("hidden", !queueOpen);

  if (!count) {
    queueLibrary.innerHTML = `<div class="empty">Add songs to your queue and they will play next.</div>`;
    return;
  }

  queue.forEach((song, index) => {
    const row = document.createElement("div");
    row.className = "song queue-song";
    row.innerHTML = `
      <div class="queue-position">${index + 1}</div>
      <div class="song-name">${highlightedSongTitle(song.title, sharedSearch.value.trim())}</div>
      <div class="song-actions">
        <div class="song-length">${formatTime(song.duration)}</div>
        <button type="button" class="queue-remove" title="Remove from queue">×</button>
      </div>`;

    row.addEventListener("click", e => {
      if (e.target.closest(".queue-remove")) return;
      queue.splice(index, 1);
      saveQueue();
      renderQueue();
      playStandaloneSong(song);
    });

    row.querySelector(".queue-remove").addEventListener("click", e => {
      e.stopPropagation();
      queue.splice(index, 1);
      saveQueue();
      renderQueue();
    });

    queueLibrary.appendChild(row);
  });
}

function addToQueue(song) {
  if (!song?.id || !song.storage_path) return;
  if (queue.some(item => item.id === song.id)) {
    setStatus(`"${song.title}" is already in the queue.`);
    queueOpen = true;
    renderQueue();
    return;
  }
  if (queue.length >= QUEUE_LIMIT) {
    setStatus(`Queue is full (${QUEUE_LIMIT} songs).`);
    return;
  }
  queue.push({ ...song, title: cleanSongTitle(song.title) });
  saveQueue();
  queueOpen = true;
  renderQueue();
  setStatus(`Added "${cleanSongTitle(song.title)}" to the queue.`);
  showToast(`Added "${cleanSongTitle(song.title)}" to the queue.`);
}

function takeNextQueuedSong() {
  if (!queue.length) return null;
  const song = queue.shift();
  saveQueue();
  renderQueue();
  return song;
}

function rememberRecentlyPlayed(song) {
  if (!song?.id) return;
  const cleanSong = { ...song, title: cleanSongTitle(song.title) };
  recentlyPlayed = [cleanSong, ...recentlyPlayed.filter(item => item.id !== cleanSong.id)].slice(0, RECENT_LIMIT);
  saveRecentlyPlayed();
  renderRecentlyPlayed();
}

function renderRecentlyPlayed() {
  const button = document.querySelector("#recentlyPlayedBtn");
  if (button) {
    button.classList.toggle("active", viewMode === "recent");
    button.textContent = recentlyPlayed.length ? `🕘 Recently Played (${recentlyPlayed.length})` : "🕘 Recently Played";
  }
}

function showRecentlyPlayed() {
  viewMode = "recent";
  libraryTitle.textContent = "Recently Played";
  if (playlistSort) playlistSort.disabled = true;
  const query = sharedSearch.value.trim().toLowerCase();
  const filteredRecent = recentlyPlayed.filter(song =>
    String(song.title || "").toLowerCase().includes(query)
  );
  songCount.textContent = `${filteredRecent.length}${query ? ` of ${recentlyPlayed.length}` : ""} ${filteredRecent.length === 1 ? "song" : "songs"}`;
  library.innerHTML = "";

  if (!recentlyPlayed.length) {
    library.innerHTML = `<div class="empty">Songs you play will appear here.</div>`;
    renderRecentlyPlayed();
    return;
  }

  if (!filteredRecent.length) {
    library.innerHTML = `<div class="empty">No recently played songs match your search.</div>`;
    renderRecentlyPlayed();
    return;
  }

  filteredRecent.forEach(song => {
    const row = document.createElement("div");
    row.className = "song" + (song.id === songs[currentSong]?.id ? " active" : "");
    row.innerHTML = `
      <div class="song-name">${highlightedSongTitle(song.title, sharedSearch.value.trim())}</div>
      <div class="song-actions">
        <div class="song-length">${formatTime(song.duration)}</div>
        ${favoriteButtonMarkup(song)}
        <button type="button" class="add-to-queue" title="Add to queue">+Q</button>
        ${songMoreButtonMarkup(song)}
      </div>`;

    row.addEventListener("click", e => {
      if (e.target.closest(".favorite, .add-to-queue, .song-more")) return;
      playStandaloneSong(song, "recent");
    });

    row.querySelector(".favorite").addEventListener("click", async e => {
      e.stopPropagation();
      await toggleFavorite(song);
    });

    row.querySelector(".add-to-queue").addEventListener("click", e => {
      e.stopPropagation();
      addToQueue(song);
    });

    row.querySelector(".song-more").addEventListener("click", e => {
      e.stopPropagation();
      openSongMenu(e.currentTarget, song);
    });

    library.appendChild(row);
  });
  renderRecentlyPlayed();
}


function isFavoritesPlaylist(playlist) {
  return String(playlist?.name || "").trim().toLowerCase() === "favorites";
}

function setStatus(msg) { status.textContent = msg || ""; }
function updatePlayerFavorite() {
  if (!playerFavorite) return;
  const song = currentPlayingSong || (currentSong >= 0 ? songs[currentSong] : null);
  const isFavorite = !!song && favoriteSongIds.has(song.id);
  playerFavorite.textContent = isFavorite ? "♥" : "♡";
  playerFavorite.classList.toggle("active", isFavorite);
  playerFavorite.title = isFavorite ? "Remove from Favorites" : "Add to Favorites";
  playerFavorite.setAttribute("aria-label", isFavorite ? "Remove current song from Favorites" : "Add current song to Favorites");
}

function updateNowPlayingInfo(song) {
  if (!playerSubtitle) return;
  if (!song) {
    playerSubtitle.textContent = "Select a song to start listening";
    if (playbackStatus) playbackStatus.textContent = "";
    return;
  }
  const sourceLabels = {
    playlist: currentPlaylist ? currentPlaylist.name : "Playlist",
    shared: "Shared Music",
    recent: "Recently Played",
    queue: "Up Next",
    favorite: "Favorites"
  };
  const source = sourceLabels[currentPlaybackSource] || "Your library";
  playerSubtitle.textContent = `${formatTime(song.duration)} • ${escapeHtml(source)}`;
  if (playbackStatus) playbackStatus.textContent = "";
}


toggleAuth.addEventListener("click", () => {
  isSignup = !isSignup;
  authSubmit.textContent = isSignup ? "Create account" : "Sign in";
  toggleAuth.textContent = isSignup ? "Already have an account? Sign in" : "Create an account";
  authMessage.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authMessage.textContent = "Working…";
  authSubmit.disabled = true;
  const credentials = { email: email.value.trim(), password: password.value };
  const result = isSignup
    ? await db.auth.signUp(credentials)
    : await db.auth.signInWithPassword(credentials);

  if (result.error) {
    authMessage.textContent = result.error.message;
    authSubmit.disabled = false;
    return;
  }

  authSubmit.disabled = false;

  if (isSignup && !result.data.session) {
    authMessage.textContent = "Account created. Check your email if confirmation is enabled.";
    return;
  }

  // Supabase has successfully authenticated the user.
  // Switch to the app immediately; playlist loading happens afterward.
  if (result.data.session) {
    user = result.data.session.user;
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    authMessage.textContent = "";

    Promise.all([loadPlaylists(), loadSharedSongs()]).catch((error) => {
      setStatus(error?.message || "Logged in, but your music could not be loaded.");
    });
  }
});

logout.addEventListener("click", async () => {
  logout.disabled = true;
  setStatus("Logging out…");

  const { error } = await db.auth.signOut();

  if (error) {
    setStatus(`Log out failed: ${error.message}`);
    logout.disabled = false;
    return;
  }

  // Switch back to the login screen immediately after a successful sign-out.
  user = null;
  playlists = [];
  currentPlaylist = null;
  songs = [];
  sharedSongs = [];
  recentlyPlayed = [];
  queue = [];
  queueOpen = false;
  queueResumeIndex = -1;
  viewMode = "playlist";
  currentSong = -1;
  queueResumeIndex = -1;
  shufflePlayed.clear();
  audio.pause();
  audio.removeAttribute("src");
  songName.textContent = "No song selected";
  currentPlaybackSource = "playlist";
  restoredPositionPending = null;
  updateNowPlayingInfo(null);
  updatePlayerFavorite();
  authForm.reset();
  authMessage.textContent = "";
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  setStatus("");
  logout.disabled = false;
});

async function boot() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    authMessage.textContent = error.message;
    return;
  }
  await handleSession(data.session);
  db.auth.onAuthStateChange(async (_event, session) => await handleSession(session));
}

async function handleSession(session) {
  if (!session) {
    user = null;
    appView.classList.add("hidden");
    authView.classList.remove("hidden");
    return;
  }
  user = session.user;
  loadRecentlyPlayed();
  loadQueue();
  loadAccountSettings();
  viewMode = "playlist";
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  await loadPlaylists();
  await loadSharedSongs();
  renderRecentlyPlayed();
  renderQueue();
  await restorePlayerState();
}

async function loadPlaylists() {
  const { data, error } = await db.from("playlists").select("*").order("created_at");
  if (error) { setStatus(error.message); return; }
  playlists = data || [];

  // Keep one built-in Favorites playlist for every account.
  let favoritesPlaylist = playlists.find(isFavoritesPlaylist);
  if (!favoritesPlaylist) {
    const { data: createdFavorites, error: favoritesError } = await db.from("playlists")
      .insert({ user_id: user.id, name: "Favorites" }).select().single();
    if (favoritesError) { setStatus(favoritesError.message); return; }
    favoritesPlaylist = createdFavorites;
    playlists.push(favoritesPlaylist);
  }

  if (!playlists.some(p => !isFavoritesPlaylist(p))) {
    const { data: created, error: createError } = await db.from("playlists")
      .insert({ user_id: user.id, name: "My Music" }).select().single();
    if (createError) { setStatus(createError.message); return; }
    playlists.push(created);
  }

  renderPlaylistSidebar();
  await loadFavoriteIds();
  const saved = playlists.find(p => p.id === currentPlaylist?.id)
    || playlists.find(p => p.id === accountSettings.defaultPlaylistId)
    || playlists.find(p => !isFavoritesPlaylist(p));
  await selectPlaylist(saved.id);
}

async function loadFavoriteIds() {
  const favoritesPlaylist = playlists.find(isFavoritesPlaylist);
  favoriteSongIds = new Set();

  if (!favoritesPlaylist) return;

  const { data, error } = await db.from("playlist_songs")
    .select("song_id")
    .eq("playlist_id", favoritesPlaylist.id);

  if (error) {
    setStatus(error.message);
    return;
  }

  favoriteSongIds = new Set((data || []).map(row => row.song_id));
}

function renderPlaylistSidebar() {
  playlistList.innerHTML = "";
  playlistCount.textContent = `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}`;

  playlists.forEach(p => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-item" + (currentPlaylist?.id === p.id ? " active" : "");
    button.title = p.name;
    button.innerHTML = `<span class="playlist-icon">${isFavoritesPlaylist(p) ? "♡" : "♫"}</span><span class="playlist-name">${escapeHtml(p.name)}</span>`;
    button.addEventListener("click", () => selectPlaylist(p.id));
    playlistList.appendChild(button);
  });
}

async function selectPlaylist(id) {
  viewMode = "playlist";
  currentPlaylist = playlists.find(p => p.id === id);
  if (!currentPlaylist) return;

  renderPlaylistSidebar();
  libraryTitle.textContent = currentPlaylist.name;
  currentSong = -1;
  currentPlayingSong = null;
  shufflePlayed.clear();
  audio.pause();
  audio.removeAttribute("src");
  songName.textContent = "No song selected";
  progress.value = 0;
  currentTime.textContent = "0:00";
  duration.textContent = "0:00";
  await loadSongs();
  renderRecentlyPlayed();
}


recentlyPlayedBtn?.addEventListener("click", () => showRecentlyPlayed());

newPlaylist.addEventListener("click", async () => {
  const name = prompt("Playlist name:");
  if (!name?.trim()) return;

  const playlistName = cleanSongTitle(name.trim());

  if (playlistName.toLowerCase() === "favorites") {
    setStatus("Favorites is reserved for your automatic favorites playlist.");
    return;
  }

  const { data, error } = await db.from("playlists")
    .insert({ user_id: user.id, name: playlistName }).select().single();

  if (error) { setStatus(error.message); return; }

  playlists.push(data);
  renderPlaylistSidebar();
  await selectPlaylist(data.id);
});

renamePlaylist.addEventListener("click", async () => {
  if (!currentPlaylist) return;

  if (isFavoritesPlaylist(currentPlaylist)) {
    setStatus("Favorites can't be renamed.");
    return;
  }

  const name = prompt("New playlist name:", currentPlaylist.name);
  if (!name?.trim()) return;

  const { data, error } = await db.from("playlists")
    .update({ name: name.trim() })
    .eq("id", currentPlaylist.id)
    .select()
    .single();

  if (error) { setStatus(error.message); return; }

  currentPlaylist = data;
  const i = playlists.findIndex(p => p.id === data.id);
  if (i !== -1) playlists[i] = data;

  renderPlaylistSidebar();
  libraryTitle.textContent = data.name;
});

deletePlaylist.addEventListener("click", async () => {
  if (!currentPlaylist) return;

  if (isFavoritesPlaylist(currentPlaylist)) {
    setStatus("Favorites can't be deleted.");
    return;
  }

  if (playlists.filter(p => !isFavoritesPlaylist(p)).length <= 1) {
    setStatus("You must keep at least one playlist.");
    return;
  }

  if (!confirm(`Delete "${currentPlaylist.name}"? Songs will remain in Shared Music.`)) return;

  const playlistId = currentPlaylist.id;
  const { error } = await db.from("playlists").delete().eq("id", playlistId);

  if (error) { setStatus(error.message); return; }

  playlists = playlists.filter(p => p.id !== playlistId);
  currentPlaylist = null;
  renderPlaylistSidebar();
  await selectPlaylist(playlists[0].id);
});

async function loadSongs() {
  const { data, error } = await db.from("playlist_songs")
    .select("id, song_id, created_at, shared_songs(*)")
    .eq("playlist_id", currentPlaylist.id)
    .order("created_at");

  if (error) { setStatus(error.message); return; }

  songs = (data || [])
    .map(row => ({ ...row.shared_songs, playlistSongId: row.id }))
    .filter(Boolean)
    .map(song => ({ ...song, title: cleanSongTitle(song.title) }));

  renderLibrary();
  songCount.textContent = `${songs.length} ${songs.length === 1 ? "song" : "songs"}`;
}

async function loadSharedSongs() {
  if (!sharedLibrary) return;

  sharedLibrary.innerHTML = `<div class="empty">Loading Shared Music…</div>`;

  try {
    const { data, error } = await db.from("shared_songs")
      .select("id, title, storage_path, duration, mime_type, uploaded_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      sharedSongs = [];
      sharedCount.textContent = "";
      sharedLibrary.innerHTML = `<div class="empty">Shared Music couldn't be loaded. ${escapeHtml(error.message)}</div>`;
      setStatus(`Shared Music error: ${error.message}`);
      return;
    }

    sharedSongs = (Array.isArray(data) ? data : []).map(song => ({
      ...song,
      title: cleanSongTitle(song.title)
    }));

    renderSharedLibrary();
    sharedCount.textContent = `${sharedSongs.length} ${sharedSongs.length === 1 ? "song" : "songs"}`;
  } catch (error) {
    sharedSongs = [];
    sharedCount.textContent = "";
    const message = error?.message || "Unknown error";
    sharedLibrary.innerHTML = `<div class="empty">Shared Music couldn't be loaded. ${escapeHtml(message)}</div>`;
    setStatus(`Shared Music error: ${message}`);
  }
}

function sortSongs(list, mode) {
  const sorted = [...list];
  const titleCompare = (a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });

  if (mode === "az") sorted.sort(titleCompare);
  else if (mode === "za") sorted.sort((a, b) => titleCompare(b, a));
  else if (mode === "shortest") sorted.sort((a, b) => Number(a.duration || 0) - Number(b.duration || 0));
  else if (mode === "longest") sorted.sort((a, b) => Number(b.duration || 0) - Number(a.duration || 0));
  else if (mode === "newest") {
    sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }
  return sorted;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightedSongTitle(title, query) {
  const text = cleanSongTitle(title);
  if (!query) return escapeHtml(text);

  const safeQuery = String(query).trim();
  if (!safeQuery) return escapeHtml(text);

  const pattern = new RegExp(`(${escapeRegExp(safeQuery)})`, "ig");
  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    result += escapeHtml(text.slice(lastIndex, index));
    result += `<mark class="search-match">${escapeHtml(match[0])}</mark>`;
    lastIndex = index + match[0].length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function renderSharedLibrary() {
  sharedLibrary.innerHTML = "";

  if (!sharedSongs.length) {
    sharedLibrary.innerHTML = `<div class="empty">No shared music yet. Upload the first song.</div>`;
    return;
  }

  const query = sharedSearch.value.trim().toLowerCase();
  const filteredSongs = sortSongs(
    sharedSongs.filter(song =>
      String(song.title || "").toLowerCase().includes(query)
    ),
    sharedSortMode
  );

  if (!filteredSongs.length) {
    sharedLibrary.innerHTML = `<div class="empty">No songs match your search.</div>`;
    return;
  }

  filteredSongs.forEach(song => {
    const row = document.createElement("div");
    row.className = "song";
    row.innerHTML = `
      <div class="song-name">${escapeHtml(song.title)}</div>
      <div class="song-actions">
        <div class="song-length">${formatTime(song.duration)}</div>
        ${favoriteButtonMarkup(song)}
        <button type="button" class="add-to-queue" title="Add to queue">+Q</button>
        <button type="button" class="add-to-playlist" title="Add to current playlist">+</button>
        ${songMoreButtonMarkup(song)}
      </div>`;

    row.addEventListener("click", e => {
      if (e.target.closest(".add-to-playlist, .add-to-queue, .favorite, .song-more")) return;
      playStandaloneSong(song, "shared");
    });

    row.querySelector(".favorite").addEventListener("click", async e => {
      e.stopPropagation();
      await toggleFavorite(song);
    });

    row.querySelector(".add-to-queue").addEventListener("click", e => {
      e.stopPropagation();
      addToQueue(song);
    });

    row.querySelector(".song-more").addEventListener("click", e => {
      e.stopPropagation();
      openSongMenu(e.currentTarget, song);
    });

    row.querySelector(".add-to-playlist").addEventListener("click", async e => {
      e.stopPropagation();
      await addSongToPlaylist(song);
    });

    sharedLibrary.appendChild(row);
  });
}


sharedSearch.addEventListener("input", () => {
  renderSharedLibrary();
  if (viewMode === "playlist") renderLibrary();
  if (viewMode === "recent") showRecentlyPlayed();
});

if (sharedSort) {
  sharedSort.addEventListener("change", () => {
    sharedSortMode = sharedSort.value;
    renderSharedLibrary();
  });
}

if (playlistSort) {
  playlistSort.addEventListener("change", () => {
    playlistSortMode = playlistSort.value;
    if (viewMode === "playlist") renderLibrary();
  });
}
function renderLibrary() {
  if (playlistSort) playlistSort.disabled = false;
  library.innerHTML = "";

  if (!songs.length) {
    library.innerHTML = `<div class="empty">Add songs from Shared Music to this playlist.</div>`;
    return;
  }

  const activeSongId = songs[currentSong]?.id;
  const displaySongs = sortSongs(songs, playlistSortMode);
  songs = displaySongs;
  currentSong = activeSongId ? songs.findIndex(song => song.id === activeSongId) : currentSong;

  const query = sharedSearch.value.trim().toLowerCase();
  const filteredSongs = songs.filter(song =>
    String(song.title || "").toLowerCase().includes(query)
  );

  if (!filteredSongs.length) {
    library.innerHTML = `<div class="empty">No songs in this library match your search.</div>`;
    return;
  }

  filteredSongs.forEach(song => {
    const songIndex = songs.findIndex(item => item.id === song.id);
    const row = document.createElement("div");
    row.className = "song" + (songIndex === currentSong ? " active" : "");
    row.innerHTML = `
      <div class="song-name">${highlightedSongTitle(song.title, sharedSearch.value.trim())}</div>
      <div class="song-actions">
        <div class="song-length">${formatTime(song.duration)}</div>
        <button type="button" class="favorite ${favoriteSongIds.has(song.id) ? "is-favorite" : ""}" title="${favoriteSongIds.has(song.id) ? "Remove from Favorites" : "Add to Favorites"}" aria-label="${favoriteSongIds.has(song.id) ? "Remove from Favorites" : "Add to Favorites"}">♡</button>
        <button type="button" class="add-to-queue" title="Add to queue">+Q</button>
        ${songMoreButtonMarkup(song)}
        <button type="button" class="delete" title="Remove from playlist">×</button>
      </div>`;

    row.addEventListener("click", e => {
      if (e.target.closest(".delete, .add-to-queue, .favorite, .song-more")) return;
      loadSong(songIndex).then(playSong);
    });

    row.querySelector(".favorite").addEventListener("click", async e => {
      e.stopPropagation();
      await toggleFavorite(song);
    });

    row.querySelector(".add-to-queue").addEventListener("click", e => {
      e.stopPropagation();
      addToQueue(song);
    });

    row.querySelector(".song-more").addEventListener("click", e => {
      e.stopPropagation();
      openSongMenu(e.currentTarget, song);
    });

    row.querySelector(".delete").addEventListener("click", async e => {
      e.stopPropagation();
      await removeSongFromPlaylist(song);
    });

    library.appendChild(row);
  });
}

async function createPlaybackUrl(song) {
  const { data, error } = await db.storage.from(BUCKET)
    .createSignedUrl(song.storage_path, 3600);

  if (error) {
    setStatus(`Couldn't access "${song.title}".`);
    return null;
  }
  return data.signedUrl;
}

async function loadSong(index, options = {}) {
  if (!songs[index]) return false;
  currentSong = index;
  const song = songs[index];
  currentPlayingSong = song;
  currentPlaybackSource = options.source || (isFavoritesPlaylist(currentPlaylist) ? "favorite" : "playlist");
  restoredPositionPending = Number.isFinite(Number(options.resumeAt)) ? Math.max(0, Number(options.resumeAt)) : null;
  if (options.remember !== false) rememberRecentlyPlayed(song);
  setStatus("Preparing…");
  if (playbackStatus) playbackStatus.textContent = "Loading song…";

  const url = await createPlaybackUrl(song);
  if (!url) return false;

  audio.src = url;
  songName.textContent = song.title;
  updateNowPlayingInfo(song);
  updatePlayerFavorite();
  duration.textContent = formatTime(song.duration);
  progress.value = 0;
  currentTime.textContent = "0:00";
  renderLibrary();
  setStatus("");
  if (playbackStatus) playbackStatus.textContent = "";
  savePlayerState();
  return true;
}


async function playStandaloneSong(song, source = "shared") {
  song = { ...song, title: cleanSongTitle(song.title) };
  currentPlaybackSource = source;
  rememberRecentlyPlayed(song);
  setStatus("Preparing…");
  if (playbackStatus) playbackStatus.textContent = "Loading song…";
  const url = await createPlaybackUrl(song);
  if (!url) return;

  currentSong = -1;
  currentPlayingSong = song;
  audio.src = url;
  songName.textContent = song.title;
  updateNowPlayingInfo(song);
  updatePlayerFavorite();
  duration.textContent = formatTime(song.duration);
  progress.value = 0;
  currentTime.textContent = "0:00";
  renderLibrary();
  setStatus("");
  savePlayerState();

  try {
    await audio.play();
  } catch {
    setStatus("Playback was blocked. Press Play again.");
  }
}

async function playSong() {
  if (currentSong < 0 && songs.length) await loadSong(0);
  if (currentSong < 0) return;

  try {
    await audio.play();
  } catch {
    setStatus("Playback was blocked. Press Play again.");
  }
}

function pauseSong() {
  audio.pause();
}

playPause.addEventListener("click", () => audio.paused ? playSong() : pauseSong());
audio.addEventListener("play", () => { playPause.textContent = "Ⅱ"; if (playbackStatus) playbackStatus.textContent = "Playing"; savePlayerState(); });
audio.addEventListener("pause", () => { playPause.textContent = "▶"; if (playbackStatus && currentPlayingSong) playbackStatus.textContent = "Paused"; savePlayerState(); });

playerFavorite?.addEventListener("click", async () => {
  const song = currentPlayingSong || (currentSong >= 0 ? songs[currentSong] : null);
  if (!song) {
    setStatus("Select a song first.");
    return;
  }
  await toggleFavorite(song);
  updatePlayerFavorite();
});

playerQueue?.addEventListener("click", () => {
  if (!queueOpen) {
    queueOpen = true;
    renderQueue();
  }
  queueSection?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

playerTimer?.addEventListener("click", () => {
  sleepTimer?.focus();
  sleepTimer?.click();
});

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  progress.value = (audio.currentTime / audio.duration) * 100;
  currentTime.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration);
  if (Date.now() - lastPlayerStateSaveAt > 2000) savePlayerState();
});

progress.addEventListener("input", () => {
  if (audio.duration) {
    audio.currentTime = Number(progress.value) / 100 * audio.duration;
    savePlayerState();
  }
});

function getNextIndex() {
  if (!songs.length) return -1;
  if (!shuffleOn) return currentSong + 1 >= songs.length ? 0 : currentSong + 1;

  if (shufflePlayed.size >= songs.length) shufflePlayed.clear();
  if (currentSong >= 0) shufflePlayed.add(currentSong);

  const available = songs
    .map((_, index) => index)
    .filter(index => !shufflePlayed.has(index));

  if (!available.length) {
    shufflePlayed.clear();
    if (currentSong >= 0) shufflePlayed.add(currentSong);
    return songs.length === 1 ? currentSong : getNextIndex();
  }

  const i = available[Math.floor(Math.random() * available.length)];
  shufflePlayed.add(i);
  return i;
}

function getPreviousIndex() {
  if (!songs.length) return -1;
  return currentSong <= 0 ? songs.length - 1 : currentSong - 1;
}

shuffle.addEventListener("click", () => {
  shuffleOn = !shuffleOn;
  shufflePlayed.clear();
  if (currentSong >= 0) shufflePlayed.add(currentSong);
  shuffle.textContent = shuffleOn ? "Shuffle: On" : "Shuffle: Off";
  shuffle.setAttribute("aria-pressed", String(shuffleOn));
  savePlayerState();
});

previous.addEventListener("click", async () => {
  if (!songs.length) return;
  const i = getPreviousIndex();
  await loadSong(i);
  playSong();
});

async function playNext() {
  if (queue.length) {
    if (queueResumeIndex < 0) queueResumeIndex = currentSong;
    const queuedSong = takeNextQueuedSong();
    await playStandaloneSong(queuedSong, "queue");
    return;
  }

  if (!songs.length) return;

  if (queueResumeIndex >= 0) {
    currentSong = queueResumeIndex;
    queueResumeIndex = -1;
  }

  if (currentSong < 0) return;
  const i = getNextIndex();
  await loadSong(i);
  playSong();
}

next.addEventListener("click", async () => {
  await playNext();
});

function updateRepeatButton() {
  if (!repeat) return;
  const labels = { off: "Repeat: Off", all: "Repeat: All", one: "Repeat: One" };
  repeat.textContent = labels[repeatMode];
  repeat.setAttribute("aria-pressed", String(repeatMode !== "off"));
  repeat.classList.toggle("active", repeatMode !== "off");
}

repeat?.addEventListener("click", () => {
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  updateRepeatButton();
  savePlayerState();
});
updateRepeatButton();

function clearSleepTimer() {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
  sleepTimerEndAt = null;
  sleepEndOfSong = false;
  if (sleepTimer) sleepTimer.value = "off";
  if (sleepTimerStatus) sleepTimerStatus.textContent = "";
}

function startSleepTimer(value) {
  if (sleepTimerId) clearTimeout(sleepTimerId);
  sleepTimerId = null;
  sleepTimerEndAt = null;
  sleepEndOfSong = false;

  if (value === "off") {
    if (sleepTimerStatus) sleepTimerStatus.textContent = "";
    return;
  }

  if (value === "end") {
    sleepEndOfSong = true;
    if (sleepTimerStatus) sleepTimerStatus.textContent = "Stops after this song";
    return;
  }

  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  sleepTimerEndAt = Date.now() + minutes * 60 * 1000;
  sleepTimerId = setTimeout(() => {
    audio.pause();
    setStatus("Sleep timer ended.");
    clearSleepTimer();
  }, minutes * 60 * 1000);
  if (sleepTimerStatus) sleepTimerStatus.textContent = `${minutes} min remaining`;
}

sleepTimer?.addEventListener("change", () => { startSleepTimer(sleepTimer.value); savePlayerState(); });

setInterval(() => {
  if (!sleepTimerEndAt || !sleepTimerStatus) return;
  const remaining = Math.max(0, sleepTimerEndAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  sleepTimerStatus.textContent = `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
  if (!remaining) sleepTimerEndAt = null;
}, 1000);

audio.addEventListener("loadedmetadata", () => {
  if (restoredPositionPending !== null) {
    const target = Math.min(restoredPositionPending, Math.max(0, audio.duration - 0.25));
    if (Number.isFinite(target) && target > 0) audio.currentTime = target;
    restoredPositionPending = null;
    currentTime.textContent = formatTime(audio.currentTime);
    duration.textContent = formatTime(audio.duration);
    progress.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    savePlayerState();
  }
});

audio.addEventListener("error", () => {
  if (!currentPlayingSong) return;
  setStatus(`Couldn't play "${currentPlayingSong.title}". Try another song.`);
  if (playbackStatus) playbackStatus.textContent = "Playback error";
  playPause.textContent = "▶";
  savePlayerState();
});

window.addEventListener("pagehide", () => savePlayerState());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") savePlayerState();
});

audio.addEventListener("ended", async () => {
  if (sleepEndOfSong) {
    audio.pause();
    clearSleepTimer();
    setStatus("Sleep timer ended after the song.");
    return;
  }

  if (repeatMode === "one") {
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      setStatus("Playback was blocked. Press Play again.");
    }
    return;
  }

  await playNext();
});

queueToggle?.addEventListener("click", () => {
  queueOpen = !queueOpen;
  renderQueue();
  savePlayerState();
});

clearQueue?.addEventListener("click", () => {
  if (!queue.length) return;
  queue = [];
  saveQueue();
  renderQueue();
  setStatus("Queue cleared.");
  savePlayerState();
});

addMusic.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const files = [...fileInput.files];
  if (!files.length) return;

  // Refresh the shared list first so duplicate checks include anything
  // uploaded by another user since the last refresh.
  await loadSharedSongs();

  const existingTitles = new Set(
    sharedSongs.map(song => cleanSongTitle(song.title).trim().toLowerCase()).filter(Boolean)
  );
  const batchTitles = new Set();
  let addedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (!file.type.startsWith("audio/")) {
      skippedCount += 1;
      continue;
    }

    const rawTitle = file.name.replace(/\.[^/.]+$/, "");
    const title = cleanSongTitle(rawTitle);
    const titleKey = title.trim().toLowerCase();

    // Skip duplicates already in Shared Music and duplicates selected in
    // the same multi-file upload. Comparison is case-insensitive and uses
    // the cleaned song title (so download-site suffixes do not create dupes).
    if (!titleKey || existingTitles.has(titleKey) || batchTitles.has(titleKey)) {
      skippedCount += 1;
      continue;
    }

    batchTitles.add(titleKey);
    setStatus(`Uploading ${file.name}…`);

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `shared/${id}-${safeName}`;

    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (uploadError) {
      skippedCount += 1;
      setStatus(`Upload failed for ${file.name}: ${uploadError.message}`);
      continue;
    }

    const probe = new Audio();
    probe.src = URL.createObjectURL(file);
    const length = await new Promise(resolve => {
      probe.addEventListener("loadedmetadata", () => resolve(probe.duration), { once: true });
      probe.addEventListener("error", () => resolve(0), { once: true });
    });
    URL.revokeObjectURL(probe.src);

    const { data: sharedSong, error: rowError } = await db.from("shared_songs")
      .insert({
        id,
        title,
        storage_path: path,
        duration: Number(length || 0),
        mime_type: file.type,
        uploaded_by: user.id
      })
      .select()
      .single();

    if (rowError) {
      // The storage object was already uploaded, so avoid creating a
      // misleading success result in the UI if the database insert fails.
      skippedCount += 1;
      setStatus(`Database error for ${file.name}: ${rowError.message}`);
      continue;
    }

    existingTitles.add(titleKey);
    addedCount += 1;
  }

  fileInput.value = "";
  await loadSharedSongs();
  if (currentPlaylist) await loadSongs();

  if (addedCount && skippedCount) {
    setStatus(`Added ${addedCount} song${addedCount === 1 ? "" : "s"}; skipped ${skippedCount} duplicate or invalid file${skippedCount === 1 ? "" : "s"}.`);
  } else if (addedCount) {
    setStatus(`Added ${addedCount} song${addedCount === 1 ? "" : "s"} to Shared Music.`);
  } else if (skippedCount) {
    setStatus(`Skipped ${skippedCount} duplicate or invalid file${skippedCount === 1 ? "" : "s"}.`);
  } else {
    setStatus("");
  }
});


async function toggleFavorite(song) {
  const favoritesPlaylist = playlists.find(isFavoritesPlaylist);
  if (!favoritesPlaylist) {
    setStatus("Favorites playlist is unavailable.");
    return;
  }

  const { data: existing, error: checkError } = await db.from("playlist_songs")
    .select("id")
    .eq("playlist_id", favoritesPlaylist.id)
    .eq("song_id", song.id)
    .maybeSingle();

  if (checkError) {
    setStatus(checkError.message);
    return;
  }

  if (existing) {
    const { error } = await db.from("playlist_songs").delete().eq("id", existing.id);
    if (error) {
      setStatus(`Couldn't remove "${song.title}" from Favorites: ${error.message}`);
      return;
    }
    setStatus(`Removed "${song.title}" from Favorites.`);
  } else {
    const { error } = await db.from("playlist_songs")
      .insert({ playlist_id: favoritesPlaylist.id, song_id: song.id });
    if (error) {
      setStatus(`Couldn't add "${song.title}" to Favorites: ${error.message}`);
      return;
    }
    setStatus(`Added "${song.title}" to Favorites.`);
  }

  await loadPlaylists();
  await loadSongs();
  if (viewMode === "recent") showRecentlyPlayed();
  renderSharedLibrary();
  updatePlayerFavorite();
}

function favoriteButtonMarkup(song) {
  const isFavorite = favoriteSongIds.has(song.id);
  return `<button type="button" class="favorite ${isFavorite ? "is-favorite" : ""}" title="${isFavorite ? "Remove from Favorites" : "Add to Favorites"}" aria-label="${isFavorite ? "Remove from Favorites" : "Add to Favorites"}">♡</button>`;
}

async function deleteOwnedSong(song) {
  if (!user || !song?.id || song.uploaded_by !== user.id) {
    setStatus("You can only delete songs you uploaded.");
    return;
  }

  const title = cleanSongTitle(song.title);
  const confirmed = confirm(`Delete "${title}" from the website?\n\nThis removes it from Shared Music and your playlists. Other users will no longer be able to play it.`);
  if (!confirmed) return;

  if (currentPlayingSong?.id === song.id || songs[currentSong]?.id === song.id) {
    audio.pause();
    audio.removeAttribute("src");
    currentSong = -1;
    currentPlayingSong = null;
    songName.textContent = "No song selected";
    updateNowPlayingInfo(null);
    updatePlayerFavorite();
    progress.value = 0;
    currentTime.textContent = "0:00";
    duration.textContent = "0:00";
  }

  queue = queue.filter(item => item.id !== song.id);
  recentlyPlayed = recentlyPlayed.filter(item => item.id !== song.id);
  saveQueue();
  saveRecentlyPlayed();

  setStatus(`Deleting "${title}"…`);

  const { error: storageError } = await db.storage.from(BUCKET).remove([song.storage_path]);
  if (storageError) {
    setStatus(`Couldn't delete the audio file: ${storageError.message}`);
    return;
  }

  const { error: rowError } = await db.from("shared_songs")
    .delete()
    .eq("id", song.id)
    .eq("uploaded_by", user.id);

  if (rowError) {
    setStatus(`Audio removed, but the song record could not be deleted: ${rowError.message}`);
    return;
  }

  favoriteSongIds.delete(song.id);
  sharedSongs = sharedSongs.filter(item => item.id !== song.id);
  songs = songs.filter(item => item.id !== song.id);
  currentSong = -1;

  await loadSharedSongs();
  if (currentPlaylist && !isFavoritesPlaylist(currentPlaylist)) {
    await loadSongs();
  } else if (currentPlaylist && isFavoritesPlaylist(currentPlaylist)) {
    await loadSongs();
  }

  if (viewMode === "recent") showRecentlyPlayed();
  renderQueue();
  renderRecentlyPlayed();
  updatePlayerFavorite();
  savePlayerState();
  showToast(`Deleted "${title}"`);
  setStatus(`Deleted "${title}" from the website.`);
}

async function addSongToPlaylist(song) {
  if (!currentPlaylist) return;

  const { error } = await db.from("playlist_songs")
    .insert({ playlist_id: currentPlaylist.id, song_id: song.id });

  if (error) {
    if (error.code === "23505") {
      setStatus("That song is already in this playlist.");
    } else {
      setStatus(error.message);
    }
    return;
  }

  await loadSongs();
  setStatus(`Added "${song.title}" to ${currentPlaylist.name}.`);
}

async function removeSongFromPlaylist(song) {
  if (!currentPlaylist) return;
  if (!confirm(`Remove "${song.title}" from this playlist? It will remain in Shared Music.`)) return;

  if (currentSong >= 0 && songs[currentSong]?.id === song.id) {
    audio.pause();
    audio.removeAttribute("src");
    currentSong = -1;
    songName.textContent = "No song selected";
  }

  const link = song.playlist_song_id || song.playlistSongId || song.id;
  const { error } = await db.from("playlist_songs")
    .delete()
    .eq("playlist_id", currentPlaylist.id)
    .eq("song_id", song.id);

  if (error) {
    setStatus(`Couldn't remove "${song.title}": ${error.message}`);
    return;
  }

  await loadSongs();
  setStatus(`Removed "${song.title}" from ${currentPlaylist.name}.`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c]));
}


// Volume controls
const volumeControl = document.getElementById("volumeControl");
const muteBtn = document.getElementById("muteBtn");
let lastVolume = 1;

function updateMuteButton() {
  if (!muteBtn) return;
  const muted = audio.muted || audio.volume === 0;
  muteBtn.textContent = muted ? "🔇" : "🔊";
  muteBtn.title = muted ? "Unmute" : "Mute";
}

if (volumeControl) {
  audio.volume = Number(volumeControl.value);
  lastVolume = audio.volume || 1;

  volumeControl.addEventListener("input", () => {
    const value = Number(volumeControl.value);
    audio.volume = value;
    audio.muted = value === 0;
    if (value > 0) lastVolume = value;
    updateMuteButton();
    savePlayerState();
  });
}

if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume || 1;
      if (volumeControl) volumeControl.value = String(audio.volume);
    } else {
      lastVolume = audio.volume || 1;
      audio.muted = true;
      if (volumeControl) volumeControl.value = "0";
    }
    updateMuteButton();
    savePlayerState();
  });
}

updateMuteButton();



// Keyboard controls
// Shortcuts are disabled while typing in a form field or using a range/select control.
document.addEventListener("keydown", async (event) => {
  const target = event.target;
  const tag = target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
  if (!user) return;

  const key = event.key.toLowerCase();

  if (event.key === " ") {
    event.preventDefault();
    if (audio.paused) await playSong();
    else pauseSong();
    return;
  }

  if (key === "n") {
    event.preventDefault();
    await playNext();
    return;
  }

  if (key === "p") {
    event.preventDefault();
    previous.click();
    return;
  }

  if (key === "m") {
    event.preventDefault();
    muteBtn?.click();
    return;
  }

  if (key === "r") {
    event.preventDefault();
    repeat?.click();
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if (!Number.isFinite(audio.duration)) return;
    event.preventDefault();
    const amount = event.key === "ArrowLeft" ? -5 : 5;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + amount));
    return;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    const amount = event.key === "ArrowUp" ? 0.05 : -0.05;
    audio.muted = false;
    audio.volume = Math.max(0, Math.min(1, audio.volume + amount));
    if (audio.volume > 0) lastVolume = audio.volume;
    if (volumeControl) volumeControl.value = String(audio.volume);
    updateMuteButton();
  }
});

/* LOGIN_REPAIR_HANDLER
   Directly wire the login button so a click always invokes the Supabase login flow.
   This preserves the existing session listener and shared-music loading. */
(() => {
  const loginButton = document.getElementById("loginBtn") ||
                       document.getElementById("loginButton") ||
                       document.querySelector('button[type="submit"]');
  const loginForm = document.getElementById("loginForm") ||
                    document.querySelector("form");

  const submitLogin = async (event) => {
    if (event) event.preventDefault();

    const emailEl = document.getElementById("email") ||
                    document.getElementById("loginEmail") ||
                    document.querySelector('input[type="email"]');
    const passwordEl = document.getElementById("password") ||
                       document.getElementById("loginPassword") ||
                       document.querySelector('input[type="password"]');

    if (!emailEl || !passwordEl) return;

    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) return;

    const statusEl = document.getElementById("authStatus") ||
                     document.getElementById("loginStatus") ||
                     document.querySelector(".auth-status");

    if (statusEl) statusEl.textContent = "Working...";
    if (loginButton) loginButton.disabled = true;

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (loginButton) loginButton.disabled = false;

    if (error) {
      if (statusEl) statusEl.textContent = error.message;
      return;
    }

    // Keep the existing session handler as the source of truth, but make the
    // successful-login transition immediate in case its callback is delayed.
    if (typeof user !== "undefined") user = data.user;
    const authViewEl = document.getElementById("authView");
    const appViewEl = document.getElementById("appView");
    if (authViewEl) authViewEl.classList.add("hidden");
    if (appViewEl) appViewEl.classList.remove("hidden");

    if (typeof loadPlaylists === "function") await loadPlaylists();
    if (typeof loadSharedSongs === "function") await loadSharedSongs();

    if (statusEl) statusEl.textContent = "";
  };

  if (loginButton) loginButton.addEventListener("click", submitLogin);
  if (loginForm) loginForm.addEventListener("submit", submitLogin);
})();


window.addEventListener("beforeunload", savePlayerState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") savePlayerState();
});
