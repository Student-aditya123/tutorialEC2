import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(currentDir, '../data')
fs.mkdirSync(dataDir, { recursive: true })
const db = new Database(path.join(dataDir, 'music.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, artist TEXT NOT NULL, album TEXT NOT NULL, color TEXT NOT NULL DEFAULT 'violet', duration TEXT NOT NULL, duration_seconds INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', color TEXT NOT NULL DEFAULT 'violet', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS playlist_tracks (playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, position INTEGER NOT NULL, PRIMARY KEY (playlist_id, track_id));
CREATE TABLE IF NOT EXISTS likes (track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE, liked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS playback_state (id INTEGER PRIMARY KEY CHECK (id = 1), track_id INTEGER REFERENCES tracks(id), position_seconds INTEGER NOT NULL DEFAULT 0, volume INTEGER NOT NULL DEFAULT 72, is_playing INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)

if (db.prepare('SELECT COUNT(*) AS count FROM tracks').get().count === 0) {
  const add = db.prepare('INSERT INTO tracks (title, artist, album, color, duration, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)')
  db.transaction(() => [
    ['Midnight City', 'M83', 'Hurry Up, We’re Dreaming', 'violet', '4:03', 243],
    ['The Less I Know The Better', 'Tame Impala', 'Currents', 'orange', '3:36', 216],
    ['Intro', 'The xx', 'xx', 'blue', '2:07', 127],
    ['Sweet Disposition', 'The Temper Trap', 'Conditions', 'pink', '3:54', 234],
    ['Space Song', 'Beach House', 'Depression Cherry', 'teal', '5:20', 320],
  ].forEach((track) => add.run(...track)))()
}

if (db.prepare('SELECT COUNT(*) AS count FROM playlists').get().count === 0) {
  const addPlaylist = db.prepare('INSERT INTO playlists (name, description, color) VALUES (?, ?, ?)')
  const addTrack = db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)')
  db.transaction(() => {
    [['Late Night Drive', 'Neon-lit roads and hazy thoughts', 'violet', [1, 2, 5]], ['Sunday Morning', 'Slow starts and warm light', 'orange', [4, 5]], ['Focus Flow', 'A little space to think', 'blue', [3, 1, 5]], ['Favorites', 'Your most loved tracks', 'pink', [1, 4]]].forEach(([name, description, color, trackIds]) => {
      const playlist = addPlaylist.run(name, description, color)
      trackIds.forEach((trackId, position) => addTrack.run(playlist.lastInsertRowid, trackId, position))
    })
    db.prepare('INSERT INTO playback_state (id, track_id, position_seconds, volume, is_playing) VALUES (1, 1, 102, 72, 1)').run()
  })()
}

export default db
