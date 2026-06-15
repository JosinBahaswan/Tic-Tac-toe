# Tic Tac Toe Multiplayer

Tic Tac Toe real-time multiplayer dibangun dengan **Vue 3 + Vite** untuk frontend dan **Vercel Serverless Functions** untuk backend. Sinkronisasi state menggunakan polling setiap 2 detik — cocok untuk game turn-based tanpa perlu WebSocket atau layanan eksternal.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + Vite |
| Backend | Vercel Serverless (Node.js) |
| Real-time | Polling (2 detik) |
| State | In-memory (`global`) |
| Font | Space Grotesk + Space Mono |

> **Upgrade ke production:** Ganti in-memory store di `api/game.js` dengan [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (`@vercel/kv`) agar state tidak hilang saat cold start.

## Cara Deploy ke Vercel

### 1. Clone & install

```bash
git clone <repo-url>
cd tic-tac-toe
npm install
```

### 2. Deploy

```bash
npm i -g vercel
vercel
```

Atau hubungkan repo ke Vercel Dashboard → Import → Deploy otomatis.

### 3. Dev lokal

```bash
# Butuh Vercel CLI untuk jalankan serverless functions lokal
npm i -g vercel
vercel dev
```

> `npm run dev` saja tidak menjalankan API. Gunakan `vercel dev` untuk development lengkap.

## Cara Main

1. **Player 1:** Buka app → isi nama → klik **Buat Game Baru** → dapat kode 6 huruf
2. **Player 2:** Buka app → isi nama → masukkan kode → klik **Gabung**
3. Main secara bergantian. Giliran & status update otomatis setiap 2 detik.

## Struktur File

```
tic-tac-toe/
├── api/
│   └── game.js          # Serverless function (create, join, move, restart)
├── src/
│   ├── main.js
│   └── App.vue          # Frontend (lobby, waiting room, board)
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Upgrade ke Vercel KV (Opsional)

Install:
```bash
npm install @vercel/kv
```

Di `api/game.js`, ganti `store.get/set` dengan:
```js
import { kv } from '@vercel/kv'

// Get
const game = await kv.get(`game:${id}`)

// Set
await kv.set(`game:${id}`, game, { ex: 7200 }) // expire 2 jam
```

Tambah env var di Vercel Dashboard:
- `KV_URL`
- `KV_REST_API_URL`  
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
