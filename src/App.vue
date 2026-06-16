<template>
  <div class="shell">
    <header class="site-header">
      <span class="logo">✕ ○</span>
      <h1>Tic Tac Toe</h1>
    </header>

    <!-- LOBBY -->
    <div v-if="screen === 'lobby'" class="lobby">
      <p class="tagline">Multiplayer · Dua pemain · Satu papan</p>

      <div class="name-row">
        <input
          v-model="playerName"
          class="input"
          placeholder="Nama kamu"
          maxlength="16"
          @keyup.enter="createGame"
        />
      </div>

      <div class="lobby-actions">
        <button class="btn btn-primary" :disabled="!playerName.trim()" @click="createGame">
          Buat Game Baru
        </button>

        <div class="divider"><span>atau</span></div>

        <div class="join-section">
          <div class="otp-row">
            <input
              v-for="(_, i) in 6"
              :key="i"
              :ref="el => { if (el) otpRefs[i] = el }"
              class="otp-box"
              type="text"
              inputmode="text"
              maxlength="1"
              :value="otpChars[i]"
              @keydown="onOtpKey($event, i)"
              @input="onOtpInput($event, i)"
              @paste.prevent="onOtpPaste($event)"
              @focus="$event.target.select()"
            />
          </div>
          <button class="btn btn-ghost" :disabled="joinCode.length < 6 || !playerName.trim()" @click="joinGame">
            Gabung
          </button>
        </div>
      </div>

      <p v-if="lobbyError" class="error-msg">{{ lobbyError }}</p>
    </div>

    <!-- WAITING ROOM -->
    <div v-else-if="screen === 'waiting'" class="waiting">
      <div class="waiting-card">
        <div class="spinner"></div>
        <p class="waiting-text">Menunggu pemain kedua…</p>
        <p class="room-label">Kode ruangan</p>
        <div class="room-code-display">
          <span class="code-big">{{ gameId }}</span>
          <button class="btn-copy" :class="{ copied }" @click="copyCode">
            {{ copied ? '✓ Tersalin' : 'Salin' }}
          </button>
        </div>
        <p class="share-hint">Bagikan kode ini ke teman kamu</p>
      </div>
    </div>

    <!-- GAME BOARD -->
    <div v-else-if="screen === 'game'" class="game-area">
      <!-- Status bar -->
      <div class="status-bar">
        <div class="player-badge" :class="{ active: game.currentTurn === 'X', winner: game.winner === 'X' }">
          <span class="sym x-sym">✕</span>
          <span class="pname">{{ game.players.X?.name }}</span>
        </div>

        <div class="turn-display">
          <template v-if="game.status === 'finished'">
            <span v-if="game.winner === 'draw'" class="result draw">Seri!</span>
            <span v-else class="result">
              {{ game.winner === yourSymbol ? '🎉 Menang!' : '😢 Kalah' }}
            </span>
          </template>
          <template v-else>
            <span class="sym-indicator" :class="game.currentTurn === 'X' ? 'x-col' : 'o-col'">
              {{ game.currentTurn === 'X' ? '✕' : '○' }}
            </span>
            <span class="turn-text">{{ isMyTurn ? 'Giliran kamu' : 'Menunggu…' }}</span>
          </template>
        </div>

        <div class="player-badge" :class="{ active: game.currentTurn === 'O', winner: game.winner === 'O' }">
          <span class="sym o-sym">○</span>
          <span class="pname">{{ game.players.O?.name }}</span>
        </div>
      </div>

      <!-- Board -->
      <div class="board">
        <button
          v-for="(cell, i) in game.board"
          :key="i"
          class="cell"
          :class="{
            'cell-x': cell === 'X',
            'cell-o': cell === 'O',
            'win-cell': game.winLine?.includes(i),
            'hoverable': !cell && isMyTurn && game.status === 'playing'
          }"
          :disabled="!!cell || !isMyTurn || game.status !== 'playing'"
          @click="makeMove(i)"
        >
          <span v-if="cell === 'X'" class="mark x-mark">✕</span>
          <span v-else-if="cell === 'O'" class="mark o-mark">○</span>
          <span v-else-if="isMyTurn && game.status === 'playing'" class="mark ghost">
            {{ yourSymbol === 'X' ? '✕' : '○' }}
          </span>
        </button>
      </div>

      <!-- Actions -->
      <div class="game-footer">
        <button v-if="game.status === 'finished'" class="btn btn-primary" @click="restartGame">
          Main Lagi
        </button>
        <button class="btn btn-ghost small" @click="leaveGame">Keluar</button>
        <span class="room-pill">Ruangan: <strong>{{ gameId }}</strong></span>
      </div>

      <p v-if="moveError" class="error-msg">{{ moveError }}</p>
    </div>

    <!-- FAQ — tampil di semua layar kecuali saat sedang main -->
    <section v-if="screen !== 'game'" class="faq-section" aria-label="Pertanyaan Umum">
      <h2 class="faq-title">Pertanyaan Umum</h2>
      <div class="faq-list">
        <div
          v-for="(item, i) in faqs"
          :key="i"
          class="faq-item"
          :class="{ open: openFaq === i }"
        >
          <button class="faq-q" @click="openFaq = openFaq === i ? null : i" :aria-expanded="openFaq === i">
            <span>{{ item.q }}</span>
            <span class="faq-icon">{{ openFaq === i ? '−' : '+' }}</span>
          </button>
          <div class="faq-a" :style="openFaq === i ? 'max-height:200px' : 'max-height:0'">
            <p>{{ item.a }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── State ─────────────────────────────────────────────────────────────────────
const screen = ref('lobby')    // lobby | waiting | game
const playerName = ref('')
const joinCode = ref('')

// OTP boxes
const otpChars = ref(Array(6).fill(''))
const otpRefs = ref([])
const lobbyError = ref('')
const moveError = ref('')
const copied = ref(false)

const gameId = ref('')
const playerId = ref('')
const yourSymbol = ref('')     // 'X' | 'O'
const game = ref(null)

let pollTimer = null

// ── FAQ ───────────────────────────────────────────────────────────────────────
const openFaq = ref(null)
const faqs = [
  {
    q: 'Bagaimana cara main bareng teman?',
    a: 'Masukkan nama kamu → klik "Buat Game Baru" → bagikan kode 6 digit ke temanmu. Teman cukup masukkan kode itu dan langsung bisa main berdua secara real-time.'
  },
  {
    q: 'Apakah perlu daftar akun?',
    a: 'Tidak perlu sama sekali. Langsung buka browser, masukkan nama, dan mulai main. Tanpa registrasi, tanpa login.'
  },
  {
    q: 'Apakah game ini gratis?',
    a: 'Ya, 100% gratis. Tidak ada iklan, tidak ada biaya tersembunyi, dan tidak ada pembelian dalam aplikasi.'
  },
  {
    q: 'Berapa lama sesi game tersimpan?',
    a: 'Ruangan aktif selama 2 jam sejak dibuat. Setelah itu otomatis dihapus. Kamu bisa buat ruangan baru kapan saja.'
  },
  {
    q: 'Bisa main di HP?',
    a: 'Bisa! Game ini sepenuhnya responsif. Berjalan lancar di browser HP maupun PC tanpa perlu install aplikasi.'
  },
  {
    q: 'Apa yang terjadi jika lawan disconnect?',
    a: 'Ruangan tetap aktif selama 2 jam. Lawan bisa kembali gabung dengan kode yang sama kapan saja selama sesi belum kedaluwarsa.'
  },
]

// ── Computed ──────────────────────────────────────────────────────────────────
const isMyTurn = computed(() =>
  game.value?.currentTurn === yourSymbol.value && game.value?.status === 'playing'
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function getOrCreatePlayerId() {
  let id = sessionStorage.getItem('ttt_pid')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('ttt_pid', id)
  }
  return id
}

async function apiCall(body) {
  const res = await fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
  stopPolling()
  pollTimer = setInterval(pollGame, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function pollGame() {
  if (!gameId.value) return
  try {
    const res = await fetch(`/api/game?id=${gameId.value}`)
    if (!res.ok) return
    const data = await res.json()
    game.value = data
    // If waiting and player 2 joined → switch to game
    if (screen.value === 'waiting' && data.status === 'playing') {
      screen.value = 'game'
    }
  } catch (e) { /* network hiccup, ignore */ }
}

// ── OTP Handlers ─────────────────────────────────────────────────────────────
function onOtpInput(e, i) {
  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  otpChars.value[i] = val.slice(-1)
  joinCode.value = otpChars.value.join('')
  if (val && i < 5) otpRefs.value[i + 1]?.focus()
}

function onOtpKey(e, i) {
  if (e.key === 'Backspace') {
    if (otpChars.value[i]) {
      otpChars.value[i] = ''
    } else if (i > 0) {
      otpChars.value[i - 1] = ''
      otpRefs.value[i - 1]?.focus()
    }
    joinCode.value = otpChars.value.join('')
  } else if (e.key === 'ArrowLeft' && i > 0) {
    otpRefs.value[i - 1]?.focus()
  } else if (e.key === 'ArrowRight' && i < 5) {
    otpRefs.value[i + 1]?.focus()
  } else if (e.key === 'Enter' && joinCode.value.length === 6) {
    joinGame()
  }
}

function onOtpPaste(e) {
  const text = (e.clipboardData || window.clipboardData)
    .getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  otpChars.value = [...text.padEnd(6, '').split('').slice(0, 6)]
  joinCode.value = otpChars.value.join('')
  const next = Math.min(text.length, 5)
  otpRefs.value[next]?.focus()
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function createGame() {
  lobbyError.value = ''
  if (!playerName.value.trim()) return
  playerId.value = getOrCreatePlayerId()
  const data = await apiCall({
    action: 'create',
    playerId: playerId.value,
    playerName: playerName.value.trim(),
  })
  if (data.error) { lobbyError.value = data.error; return }
  gameId.value = data.id
  yourSymbol.value = data.yourSymbol
  game.value = data
  screen.value = data.status === 'playing' ? 'game' : 'waiting'
  startPolling()
}

async function joinGame() {
  lobbyError.value = ''
  if (!joinCode.value.trim() || !playerName.value.trim()) return
  playerId.value = getOrCreatePlayerId()
  const data = await apiCall({
    action: 'join',
    gameId: joinCode.value.trim().toUpperCase(),
    playerId: playerId.value,
    playerName: playerName.value.trim(),
  })
  if (data.error) { lobbyError.value = data.error; return }
  gameId.value = data.id
  yourSymbol.value = data.yourSymbol
  game.value = data
  screen.value = 'game'
  startPolling()
}

async function makeMove(index) {
  moveError.value = ''
  const data = await apiCall({
    action: 'move',
    gameId: gameId.value,
    playerId: playerId.value,
    index,
  })
  if (data.error) { moveError.value = data.error; return }
  game.value = data
}

async function restartGame() {
  const data = await apiCall({
    action: 'restart',
    gameId: gameId.value,
    playerId: playerId.value,
  })
  if (!data.error) game.value = data
}

function leaveGame() {
  stopPolling()
  gameId.value = ''
  yourSymbol.value = ''
  game.value = null
  joinCode.value = ''
  otpChars.value = Array(6).fill('')
  screen.value = 'lobby'
}

async function copyCode() {
  await navigator.clipboard.writeText(gameId.value).catch(() => {})
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  const saved = sessionStorage.getItem('ttt_pid')
  if (saved) playerId.value = saved
})

onUnmounted(stopPolling)
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f0f13;
  --surface: #1a1a23;
  --surface2: #24242f;
  --border: #2e2e3d;
  --x-col: #f05c5c;
  --o-col: #5c9ef0;
  --text: #e8e8f0;
  --muted: #7070a0;
  --win: #f0c85c;
  --radius: 12px;
  --ff-display: 'Space Mono', monospace;
  --ff-body: 'Space Grotesk', sans-serif;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--ff-body);
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

#app { width: 100%; max-width: 480px; padding: 0 16px 48px; }

/* ── Header ── */
.site-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 28px 0 24px;
}
.logo {
  font-family: var(--ff-display);
  font-size: 1.4rem;
  letter-spacing: 4px;
  color: var(--muted);
}
.site-header h1 {
  font-family: var(--ff-display);
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* ── Inputs & buttons ── */
.input {
  width: 100%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--ff-body);
  font-size: 1rem;
  padding: 12px 16px;
  outline: none;
  transition: border-color .2s;
}
.input:focus { border-color: var(--o-col); }
.code-input { font-family: var(--ff-display); letter-spacing: .14em; text-transform: uppercase; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  font-family: var(--ff-body);
  font-size: 1rem;
  font-weight: 600;
  padding: 13px 24px;
  transition: opacity .15s, transform .1s;
}
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn:not(:disabled):hover { opacity: .85; }
.btn:not(:disabled):active { transform: scale(.97); }
.btn-primary { background: var(--o-col); color: #fff; }
.btn-ghost { background: var(--surface2); color: var(--text); border: 1.5px solid var(--border); }
.btn.small { font-size: .9rem; padding: 9px 18px; }

/* ── Lobby ── */
.lobby { display: flex; flex-direction: column; gap: 20px; }
.tagline { color: var(--muted); font-size: .95rem; margin-bottom: 4px; }
.lobby-actions { display: flex; flex-direction: column; gap: 12px; }
.lobby-actions .btn { width: 100%; }
.join-section { display: flex; flex-direction: column; gap: 10px; }
.join-section .btn { width: 100%; }
.otp-row { display: flex; gap: 8px; justify-content: center; }
.otp-box {
  width: 100%;
  aspect-ratio: 1;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-family: var(--ff-display);
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
  outline: none;
  transition: border-color .2s, background .2s;
  caret-color: transparent;
}
.otp-box:focus { border-color: var(--o-col); background: var(--surface2); }
.otp-box:not(:placeholder-shown) { border-color: var(--muted); }
.divider { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: .85rem; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.error-msg { color: var(--x-col); font-size: .9rem; text-align: center; }

/* ── Waiting ── */
.waiting { display: flex; justify-content: center; padding-top: 32px; }
.waiting-card {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 36px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--o-col);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.waiting-text { font-size: 1.05rem; color: var(--muted); }
.room-label { font-size: .8rem; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-top: 8px; }
.room-code-display { display: flex; align-items: center; gap: 12px; }
.code-big { font-family: var(--ff-display); font-size: 2.2rem; letter-spacing: .18em; color: var(--text); }
.btn-copy {
  background: var(--surface2);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--ff-body);
  font-size: .8rem;
  padding: 6px 12px;
  transition: all .2s;
}
.btn-copy.copied { border-color: #5cd45c; color: #5cd45c; }
.share-hint { font-size: .85rem; color: var(--muted); }

/* ── Game ── */
.game-area { display: flex; flex-direction: column; align-items: center; gap: 20px; }

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 14px 18px;
  gap: 8px;
}
.player-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  opacity: .4;
  transition: opacity .25s;
}
.player-badge.active { opacity: 1; }
.player-badge.winner { opacity: 1; }
.player-badge.winner .sym { filter: drop-shadow(0 0 8px currentColor); }
.sym { font-family: var(--ff-display); font-size: 1.4rem; line-height: 1; }
.x-sym { color: var(--x-col); }
.o-sym { color: var(--o-col); }
.pname { font-size: .8rem; color: var(--muted); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.turn-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1.2;
}
.sym-indicator { font-family: var(--ff-display); font-size: 1.6rem; }
.x-col { color: var(--x-col); }
.o-col { color: var(--o-col); }
.turn-text { font-size: .78rem; color: var(--muted); }
.result { font-family: var(--ff-display); font-size: 1rem; color: var(--win); }
.result.draw { color: var(--muted); }

/* ── Board ── */
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  aspect-ratio: 1;
}
.cell {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s, border-color .15s;
  position: relative;
  overflow: hidden;
}
.cell:disabled { cursor: default; }
.cell.hoverable:hover { background: var(--surface2); border-color: var(--muted); }
.cell.hoverable:hover .ghost { opacity: .25; }
.cell.win-cell { border-color: var(--win); background: rgba(240, 200, 92, .08); }

.mark {
  font-family: var(--ff-display);
  font-size: clamp(2rem, 10vw, 3.2rem);
  line-height: 1;
  display: block;
  animation: pop .18s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.x-mark { color: var(--x-col); }
.o-mark { color: var(--o-col); }
.ghost { color: var(--muted); opacity: 0; transition: opacity .15s; pointer-events: none; }

/* ── Footer ── */
.game-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}
.room-pill {
  font-size: .82rem;
  color: var(--muted);
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  font-family: var(--ff-display);
  letter-spacing: .06em;
}

/* ── FAQ ── */
.faq-section {
  margin-top: 40px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}
.faq-title {
  font-family: var(--ff-display);
  font-size: .75rem;
  font-weight: 400;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 16px;
}
.faq-list { display: flex; flex-direction: column; gap: 8px; }
.faq-item {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color .2s;
}
.faq-item.open { border-color: var(--muted); }
.faq-q {
  width: 100%;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--ff-body);
  font-size: .95rem;
  font-weight: 500;
  gap: 12px;
  padding: 14px 16px;
  text-align: left;
}
.faq-q:hover { color: #fff; }
.faq-icon {
  color: var(--muted);
  flex-shrink: 0;
  font-size: 1.2rem;
  font-family: var(--ff-display);
  line-height: 1;
  transition: color .2s;
}
.faq-item.open .faq-icon { color: var(--o-col); }
.faq-a {
  overflow: hidden;
  max-height: 0;
  transition: max-height .3s ease;
}
.faq-a p {
  color: var(--muted);
  font-size: .9rem;
  line-height: 1.65;
  padding: 0 16px 16px;
}
</style>
