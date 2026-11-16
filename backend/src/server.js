import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import db from './database.js'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 5000
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

const trackSelect = `SELECT t.*, EXISTS(SELECT 1 FROM likes l WHERE l.track_id = t.id) AS liked FROM tracks t`

app.get('/', (_req, res) => res.json({ name: 'Luma Music API', version: '1.0.0' }))
app.get('/api/health', (_req, res) => res.json({ success: true, database: db.prepare('SELECT 1 AS ok').get().ok === 1, message: 'Backend API is working!' }))

app.get('/api/tracks', (req, res) => {
  const search = String(req.query.search || '').trim()
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
  const data = search
    ? db.prepare(`${trackSelect} WHERE t.title LIKE @search OR t.artist LIKE @search OR t.album LIKE @search ORDER BY t.id LIMIT @limit`).all({ search: `%${search}%`, limit })
    : db.prepare(`${trackSelect} ORDER BY t.id LIMIT @limit`).all({ limit })
  res.json({ success: true, data })
})

app.get('/api/tracks/:id', (req, res) => {
  const data = db.prepare(`${trackSelect} WHERE t.id = ?`).get(Number(req.params.id))
  if (!data) return res.status(404).json({ success: false, error: 'Track not found' })
  res.json({ success: true, data })
})

app.get('/api/playlists', (_req, res) => {
  const data = db.prepare('SELECT p.*, COUNT(pt.track_id) AS track_count FROM playlists p LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id GROUP BY p.id ORDER BY p.id').all()
  res.json({ success: true, data })
})

app.get('/api/playlists/:id', (req, res) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(Number(req.params.id))
  if (!playlist) return res.status(404).json({ success: false, error: 'Playlist not found' })
  const tracks = db.prepare(`${trackSelect} JOIN playlist_tracks pt ON pt.track_id = t.id WHERE pt.playlist_id = ? ORDER BY pt.position`).all(playlist.id)
  res.json({ success: true, data: { ...playlist, tracks } })
})

app.put('/api/tracks/:id/like', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM tracks WHERE id = ?').get(id)) return res.status(404).json({ success: false, error: 'Track not found' })
  const liked = Boolean(req.body?.liked)
  if (liked) db.prepare('INSERT OR IGNORE INTO likes (track_id) VALUES (?)').run(id)
  else db.prepare('DELETE FROM likes WHERE track_id = ?').run(id)
  res.json({ success: true, data: { track_id: id, liked } })
})

app.get('/api/playback', (_req, res) => {
  const data = db.prepare('SELECT ps.*, t.title, t.artist, t.album, t.color, t.duration FROM playback_state ps LEFT JOIN tracks t ON t.id = ps.track_id WHERE ps.id = 1').get()
  res.json({ success: true, data })
})

app.put('/api/playback', (req, res) => {
  const { track_id: trackId, position_seconds: position = 0, volume = 72, is_playing: isPlaying = false } = req.body || {}
  if (trackId != null && !db.prepare('SELECT id FROM tracks WHERE id = ?').get(Number(trackId))) return res.status(400).json({ success: false, error: 'Invalid track_id' })
  db.prepare('UPDATE playback_state SET track_id = COALESCE(@trackId, track_id), position_seconds = @position, volume = @volume, is_playing = @isPlaying, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run({ trackId: trackId == null ? null : Number(trackId), position: Math.max(Number(position) || 0, 0), volume: Math.min(Math.max(Number(volume) || 0, 0), 100), isPlaying: isPlaying ? 1 : 0 })
  res.json({ success: true, data: db.prepare('SELECT * FROM playback_state WHERE id = 1').get() })
})

app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }))
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ success: false, error: 'Internal server error' }) })
app.listen(PORT, () => console.log(`Luma API running on http://localhost:${PORT}`))
