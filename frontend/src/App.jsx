import { useEffect, useMemo, useState } from 'react'
import './App.css'

const fallbackTracks = [
  { id: 1, title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We’re Dreaming', color: 'violet', time: '4:03' },
  { id: 2, title: 'The Less I Know The Better', artist: 'Tame Impala', album: 'Currents', color: 'orange', time: '3:36' },
  { id: 3, title: 'Intro', artist: 'The xx', album: 'xx', color: 'blue', time: '2:07' },
  { id: 4, title: 'Sweet Disposition', artist: 'The Temper Trap', album: 'Conditions', color: 'pink', time: '3:54' },
  { id: 5, title: 'Space Song', artist: 'Beach House', album: 'Depression Cherry', color: 'teal', time: '5:20' },
]

function Icon({ name, size = 20, fill = 'none' }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/></>,
    library: <><path d="M4 4v16M8 4v16M12 4v16M16 4v16M20 4v16"/></>,
    heart: <path d="M20.8 8.9c0 5.5-8.8 10-8.8 10s-8.8-4.5-8.8-10A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.9Z" fill={fill}/>,
    plus: <><path d="M12 5v14M5 12h14"/></>, more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>, play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>, pause: <><path d="M8 5v14M16 5v14"/></>, prev: <><path d="m18 6-8 6 8 6V6ZM6 6v12"/></>, next: <><path d="m6 6 8 6-8 6V6ZM18 6v12"/></>,
    volume: <><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Cover({ color = 'violet', small = false }) {
  return <div className={`cover ${color} ${small ? 'small' : ''}`}><span className="cover-orb orb-one"/><span className="cover-orb orb-two"/><span className="cover-lines"/></div>
}

function App() {
  const [tracks, setTracks] = useState(fallbackTracks)
  const [playlists, setPlaylists] = useState([])
  const [view, setView] = useState('home')
  const [activeId, setActiveId] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [query, setQuery] = useState('')
  const [liked, setLiked] = useState(false)
  const [volume, setVolume] = useState(72)
  const [progress, setProgress] = useState(42)
  const active = tracks.find((track) => track.id === activeId) || tracks[0]
  const visibleTracks = useMemo(() => tracks.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(query.toLowerCase())), [query])
  const savePlayback = (values) => fetch('/api/playback', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }).catch(() => {})
  useEffect(() => {
    Promise.all([fetch('/api/tracks').then((response) => response.json()), fetch('/api/playback').then((response) => response.json()), fetch('/api/playlists').then((response) => response.json())])
      .then(([trackResponse, playbackResponse, playlistResponse]) => {
        if (trackResponse.success) {
          const loadedTracks = trackResponse.data.map((track) => ({ ...track, time: track.duration }))
          setTracks(loadedTracks)
          setLiked(Boolean(loadedTracks.find((track) => track.id === activeId)?.liked))
        }
        if (playbackResponse.success && playbackResponse.data?.track_id) {
          setActiveId(playbackResponse.data.track_id)
          setPlaying(Boolean(playbackResponse.data.is_playing))
          setVolume(playbackResponse.data.volume)
          setProgress(Math.min(100, (playbackResponse.data.position_seconds / 243) * 100))
        }
        if (playlistResponse.success) setPlaylists(playlistResponse.data)
      }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!playing || !active) return undefined
    const timer = window.setInterval(() => setProgress((current) => {
      const nextProgress = current + (100 / Math.max(active.duration_seconds || 240, 1))
      if (nextProgress >= 100) { nextTrack(); return 0 }
      return nextProgress
    }), 1000)
    return () => window.clearInterval(timer)
  }, [playing, activeId, active])
  const loadPlaylist = (playlistId) => {
    fetch(`/api/playlists/${playlistId}`).then((response) => response.json()).then((response) => {
      if (!response.success || !response.data.tracks.length) return
      setTracks(response.data.tracks.map((track) => ({ ...track, time: track.duration })))
      setActiveId(response.data.tracks[0].id)
      setPlaying(true)
      setView('library')
      setProgress(0)
    }).catch(() => {})
  }
  const setPlayerProgress = (event) => {
    const nextProgress = Number(event.target.value)
    setProgress(nextProgress)
    savePlayback({ track_id: active.id, is_playing: playing, volume, position_seconds: Math.round((nextProgress / 100) * (active.duration_seconds || 240)) })
  }
  const chooseTrack = (id) => { setActiveId(id); setPlaying(true); setLiked(false); savePlayback({ track_id: id, is_playing: true, volume }) ; fetch(`/api/tracks/${id}/like`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liked: false }) }).catch(() => {}) }
  const nextTrack = () => chooseTrack(activeId === tracks.length ? 1 : activeId + 1)
  const previousTrack = () => chooseTrack(activeId === 1 ? tracks.length : activeId - 1)
  const upNext = tracks[activeId % tracks.length]

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><i/><i/><i/></span><span>luma</span></div>
        <nav className="main-nav" aria-label="Main navigation"><button className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}><Icon name="home"/> Home</button><button className={`nav-item ${view === 'discover' ? 'active' : ''}`} onClick={() => { setView('discover'); setQuery('') }}><Icon name="compass"/> Discover</button><button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}><Icon name="library"/> Your library</button></nav>
        <div className="side-section"><div className="section-label">Your playlists <button aria-label="Add playlist"><Icon name="plus" size={17}/></button></div><div className="playlist-list">{(playlists.length ? playlists : [{ id: 1, name: 'Late Night Drive' }, { id: 2, name: 'Sunday Morning' }, { id: 3, name: 'Focus Flow' }, { id: 4, name: 'Favorites' }]).map((playlist, index) => <button className="playlist-link" key={playlist.id} onClick={() => loadPlaylist(playlist.id)}><span className={`playlist-dot p${index % 4}`}/>{playlist.name}</button>)}</div></div>
        <div className="sidebar-footer"><div className="profile"><span className="avatar">AD</span><span><b>Aditya</b><small>Free account</small></span></div><button className="more" aria-label="More options"><Icon name="more"/></button></div>
      </aside>
      <section className="content">
        <header className="topbar"><div className="search-wrap"><Icon name="search" size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, albums..." aria-label="Search music"/><kbd>⌘ K</kbd></div><button className="upgrade">Upgrade <span>↗</span></button></header>
        <div className="hero-copy"><p className="eyebrow">Good evening, Aditya <span>✦</span></p><h1>Find your next<br/><em>favorite sound.</em></h1><p className="hero-subtitle">Handpicked music for every moment, mood, and<br/>midnight thought.</p></div>
        <section className="section-block"><div className="section-heading"><h2>Made for you</h2><button className="text-button">See all <span>→</span></button></div><div className="cards">
          <button className="feature-card" onClick={() => chooseTrack(1)}><Cover color="violet"/><span className="card-tag">Daily mix</span><strong>Violet hours</strong><small>M83, The xx, Beach House & more</small><span className="card-play"><Icon name="play" size={18}/></span></button>
          <button className="feature-card" onClick={() => chooseTrack(2)}><Cover color="orange"/><span className="card-tag">For your mood</span><strong>Golden hour</strong><small>Warm sounds for slow afternoons</small><span className="card-play"><Icon name="play" size={18}/></span></button>
          <button className="feature-card" onClick={() => chooseTrack(3)}><Cover color="blue"/><span className="card-tag">Recently played</span><strong>Soft focus</strong><small>Ambient moments to drift away</small><span className="card-play"><Icon name="play" size={18}/></span></button>
        </div></section>
        <section className="section-block tracks-section"><div className="section-heading"><div><h2>Popular right now</h2><p>What everyone’s listening to</p></div><button className="text-button">View all <span>→</span></button></div><div className="track-list">{visibleTracks.map((track, index) => <button className={`track-row ${activeId === track.id ? 'selected' : ''}`} key={track.id} onClick={() => chooseTrack(track.id)}><span className="track-number">{activeId === track.id && playing ? <span className="equalizer"><i/><i/><i/></span> : String(index + 1).padStart(2, '0')}</span><Cover color={track.color} small/><span className="track-meta"><strong>{track.title}</strong><small>{track.artist}</small></span><span className="track-album">{track.album}</span><span className="track-time">{track.time}</span><span className="track-more"><Icon name="more" size={18}/></span></button>)}{visibleTracks.length === 0 && <p className="empty-state">No tracks found. Try another search.</p>}</div></section>
      </section>
      <aside className="now-playing"><div className="now-header"><span>Now playing</span><button aria-label="More options"><Icon name="more"/></button></div><Cover color={active.color}/><div className="now-meta"><div><h2>{active.title}</h2><p>{active.artist}</p></div><button className={`heart-button ${liked ? 'liked' : ''}`} onClick={() => { const nextLiked = !liked; setLiked(nextLiked); fetch(`/api/tracks/${active.id}/like`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liked: nextLiked }) }).catch(() => {}) }} aria-label="Like track"><Icon name="heart" fill={liked ? 'currentColor' : 'none'}/></button></div><div className="progress"><div className="progress-label"><span>1:42</span><span>{active.time}</span></div><input type="range" min="0" max="100" defaultValue="42" aria-label="Track progress"/></div><div className="player-controls"><button onClick={previousTrack} aria-label="Previous track"><Icon name="prev"/></button><button className="main-play" onClick={() => { const nextPlaying = !playing; setPlaying(nextPlaying); savePlayback({ track_id: active.id, is_playing: nextPlaying, volume }) }} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={22}/></button><button onClick={nextTrack} aria-label="Next track"><Icon name="next"/></button></div><div className="volume"><Icon name="volume" size={18}/><input type="range" min="0" max="100" value={volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); savePlayback({ track_id: active.id, is_playing: playing, volume: nextVolume }) }} aria-label="Volume"/></div><div className="up-next"><div className="up-next-heading"><span>Up next</span><button>Clear</button></div><div className="next-track"><Cover color={upNext.color} small/><span><b>{upNext.title}</b><small>{upNext.artist}</small></span><span className="next-time">{upNext.time}</span></div></div></aside>
    </main>
  )
}

export default App
