import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, LockKeyhole, FlaskConical, ChevronDown, Settings2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { BrandMark, Wordmark } from './components/Brand'
import { api, post, setSession, setLockHandler } from './api'
import type { Status } from './types'
import Lock from './pages/Lock'
import QuickSwitcher from './components/QuickSwitcher'
import { workspacePages, type Page } from './workspace'
import SessionPage from './components/SessionPage'
import Main from './pages/Main'
import Library from './pages/Library'
import Ask from './pages/Ask'
import Quiz from './pages/Quiz'
import ThemeToggle from './components/ThemeToggle'
import OfflineProof from './components/OfflineProof'
import RecoverySettings from './pages/RecoverySettings'

export default function App() {
  const [token, setToken] = useState<string | null>(null); const [status, setStatus] = useState<Status | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)
  const [page, setPage] = useState<Page>('main'); const [demo, setDemo] = useState(false); const [error, setError] = useState('')
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    try { return localStorage.getItem('tiboq-sidebar-minimized') === 'true' } catch { return false }
  })
  function toggleSidebar() {
    const next = !sidebarMinimized
    setSidebarMinimized(next)
    try { localStorage.setItem('tiboq-sidebar-minimized', String(next)) } catch { /* Keep this session's preference. */ }
  }
  const content = useRef<HTMLElement>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearSession = useCallback(() => { setSession(null); setToken(null); setDemo(false); setPage('main'); setStatus(prev => prev ? {...prev, initialized: true, unlocked: false, documents: null, chunks: null} : null) }, [])
  const refresh = useCallback(() => { api<Status>('/api/status').then(setStatus).catch(e => setError(e.message)) }, [])
  useEffect(() => { setLockHandler(clearSession); refresh(); return () => setLockHandler(() => {}) }, [clearSession, refresh])
  const lock = useCallback(() => { void post('/api/lock', {}).catch(() => {}); clearSession() }, [clearSession])
  useEffect(() => {
    if (!token) return
    let lastTouch = 0
    function activity() {
      clearTimeout(timeout.current); timeout.current = setTimeout(lock, (status?.auto_lock_minutes ?? 5) * 60000)
      if (Date.now() - lastTouch > Math.min(15000, (status?.auto_lock_minutes ?? 5) * 20000)) { lastTouch = Date.now(); void post('/api/session/touch', {}).catch(() => {}) }
    }
    activity()
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach(event => window.addEventListener(event, activity, {passive: true}))
    return () => { clearTimeout(timeout.current); events.forEach(event => window.removeEventListener(event, activity)) }
  }, [token, lock, status?.auto_lock_minutes])
  async function toggleDemo(value: boolean) {
    setDemo(value); setPage('main'); setError('')
    if (value) { setDemoBusy(true); try { await post('/api/demo/library', {}); refresh() } catch (e) { setError('Demo presentation loaded. Sample library: ' + (e as Error).message) } finally { setDemoBusy(false) } }
  }
  function unlock(value: string) { setSession(value); setToken(value); setError(''); refresh() }

  const nav = workspacePages
  function navigate(next: Page) {
    setPage(next); refresh()
    requestAnimationFrame(() => content.current?.focus())
  }
  return <div className="app-frame min-h-screen flex flex-col">
    <a href="#workspace-content" className="skip-link">Skip to workspace</a>
    <header className="app-header sticky top-0 z-40 h-[76px] px-5 lg:px-9 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3"><BrandMark className="w-10 h-10 text-[#10211F]"/><Wordmark/></div>
      <div className="header-actions flex gap-3 items-center">
        <span className="hidden md:flex items-center gap-2 text-xs text-teal-800"><ShieldCheck size={14}/>On-device only</span>
        <ThemeToggle/>
        {token && <button className="btn !py-2 !text-xs" onClick={lock}><LockKeyhole size={14}/>Lock vault</button>}
      </div>
    </header>
    {token ? <div className="workspace-shell flex-1" key={token}>
      <aside className="workspace-sidebar" data-minimized={sidebarMinimized}>
        <div className="sidebar-surface">
        <div className="workspace-navigation">
          <div className="sidebar-heading">
            <p className="eyebrow workspace-label">Workspace</p>
            <button type="button" className="sidebar-minimize" onClick={event => {
              toggleSidebar()
              if (event.detail > 0) content.current?.focus({ preventScroll: true })
            }} aria-label="Auto-hide sidebar" aria-pressed={sidebarMinimized} aria-controls="workspace-navigation"
              title={sidebarMinimized ? 'Pin sidebar open' : 'Minimize sidebar'}>
              {sidebarMinimized ? <PanelLeftOpen size={19} aria-hidden="true"/> : <PanelLeftClose size={19} aria-hidden="true"/>}
            </button>
          </div>
          <QuickSwitcher onNavigate={navigate}/>
          <nav id="workspace-navigation" aria-label="Workspace navigation">{nav.map(({id, label, description, icon: Icon}) =>
            <button type="button" key={id} aria-label={label} title={label} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
              <span className="workspace-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span>
              <span className="workspace-nav-copy"><span className="workspace-nav-label">{label}</span><span className="workspace-nav-description">{description}</span></span>
            </button>
          )}</nav>
        </div>
        <details className="workspace-tools">
          <summary aria-label="Workspace tools" title="Workspace tools"><span><Settings2 size={16} aria-hidden="true"/><span className="workspace-tools-label">Workspace tools</span></span><ChevronDown className="workspace-tools-chevron" size={14} aria-hidden="true"/></summary>
          <div className="workspace-tools-body">
            <label className="demo-control"><span><FlaskConical size={16}/>Demo mode</span><input type="checkbox" checked={demo} disabled={demoBusy} onChange={e => void toggleDemo(e.target.checked)}/></label>
            <p className="text-xs text-slate-500 mb-4">Load a fictional encounter and sample sources.</p>
            <OfflineProof status={status}/>
          </div>
        </details>
        </div>
      </aside>
      <main id="workspace-content" ref={content} tabIndex={-1} className="workspace-content">
        {error && <p role="alert" className="error mb-5">{error}</p>}
        {demoBusy && <p role="status" className="text-sm text-teal-800 mb-4">Preparing sample sources locally...</p>}
        <SessionPage active={page === 'main'}><Main active={page === 'main'} demo={demo} refresh={refresh}/></SessionPage>
        <SessionPage active={page === 'library'}><Library active={page === 'library'} demo={demo} refresh={refresh} onNavigate={navigate}/></SessionPage>
        <SessionPage active={page === 'ask'}><Ask onOpenLibrary={() => navigate('library')}/></SessionPage>
        <SessionPage active={page === 'quiz'}><Quiz active={page === 'quiz'} onOpenLibrary={() => navigate('library')}/></SessionPage>
        {page === 'settings' && <RecoverySettings configured={status?.recovery_configured ?? false} refresh={refresh}/>}
      </main>
    </div> : <main id="workspace-content" className="flex-1 px-6 lg:px-10">
      {status ? <Lock initialized={status.initialized} recoveryConfigured={status.recovery_configured} onUnlock={unlock}/> : <p role="status" className="text-center py-16 text-sm text-slate-500">{error ? 'Connect to the local backend to open your vault.' : 'Connecting to your local workspace...'}</p>}
      {error && <div className="max-w-lg mx-auto mb-6"><p role="alert" className="error">{error}</p><button className="btn mt-3" onClick={refresh}>Retry local backend</button></div>}
    </main>}
    <footer className="border-t border-slate-200 px-5 py-4 text-center text-[11px] text-slate-500">Unsaved work clears when the vault locks. Draft-support tool; not a diagnostic tool or the official medical record.</footer>
  </div>
}
