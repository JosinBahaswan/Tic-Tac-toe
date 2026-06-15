// api/game.js
// In-memory store — persists across warm invocations on the same instance.
// For production: swap with Vercel KV (@vercel/kv) or Upstash Redis.

const store = globalThis.__games || (globalThis.__games = new Map())

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],             // diags
  ]
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] }
    }
  }
  if (board.every(Boolean)) return { winner: 'draw', line: [] }
  return null
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET /api/game?id=XXXX — poll current state
  if (req.method === 'GET') {
    const { id } = req.query
    const game = store.get(id)
    if (!game) return res.status(404).json({ error: 'Game not found' })
    return res.json(game)
  }

  // POST /api/game — create or join
  if (req.method === 'POST') {
    const { action, gameId, playerId, playerName } = req.body

    // --- CREATE ---
    if (action === 'create') {
      const id = gameId || Math.random().toString(36).slice(2, 8).toUpperCase()
      if (store.has(id)) {
        // Try to join as existing game
        return joinGame(id, playerId, playerName, res)
      }
      const game = {
        id,
        board: Array(9).fill(null),
        players: { X: { id: playerId, name: playerName || 'Player X' } },
        currentTurn: 'X',
        winner: null,
        winLine: [],
        status: 'waiting', // waiting | playing | finished
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.set(id, game)
      // Cleanup old games (>2hrs)
      for (const [k, v] of store) {
        if (Date.now() - v.createdAt > 2 * 60 * 60 * 1000) store.delete(k)
      }
      return res.json({ ...game, yourSymbol: 'X' })
    }

    // --- JOIN ---
    if (action === 'join') {
      return joinGame(gameId?.toUpperCase(), playerId, playerName, res)
    }

    // --- MOVE ---
    if (action === 'move') {
      const { index } = req.body
      const game = store.get(gameId?.toUpperCase())
      if (!game) return res.status(404).json({ error: 'Game not found' })
      if (game.status !== 'playing') return res.status(400).json({ error: 'Game not active' })

      const symbol = game.players.X.id === playerId ? 'X' : 'O'
      if (game.currentTurn !== symbol) return res.status(400).json({ error: 'Not your turn' })
      if (game.board[index] !== null) return res.status(400).json({ error: 'Cell taken' })

      game.board[index] = symbol
      const result = checkWinner(game.board)
      if (result) {
        game.winner = result.winner
        game.winLine = result.line
        game.status = 'finished'
      } else {
        game.currentTurn = symbol === 'X' ? 'O' : 'X'
      }
      game.updatedAt = Date.now()
      store.set(game.id, game)
      return res.json(game)
    }

    // --- RESTART ---
    if (action === 'restart') {
      const game = store.get(gameId?.toUpperCase())
      if (!game) return res.status(404).json({ error: 'Game not found' })

      game.board = Array(9).fill(null)
      game.currentTurn = 'X'
      game.winner = null
      game.winLine = []
      game.status = 'playing'
      game.updatedAt = Date.now()
      store.set(game.id, game)
      return res.json(game)
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

function joinGame(gameId, playerId, playerName, res) {
  const game = store.get(gameId)
  if (!game) return res.status(404).json({ error: 'Game not found' })

  // Already in game
  if (game.players.X?.id === playerId) return res.json({ ...game, yourSymbol: 'X' })
  if (game.players.O?.id === playerId) return res.json({ ...game, yourSymbol: 'O' })

  if (game.players.O) return res.status(400).json({ error: 'Game is full' })

  game.players.O = { id: playerId, name: playerName || 'Player O' }
  game.status = 'playing'
  game.updatedAt = Date.now()
  store.set(gameId, game)
  return res.json({ ...game, yourSymbol: 'O' })
}
