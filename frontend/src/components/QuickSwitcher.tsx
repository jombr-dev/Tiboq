import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import Modal from './Modal'
import { findWorkspacePages, type Page } from '../workspace'

export default function QuickSwitcher({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const results = useRef<HTMLUListElement>(null)
  const matches = findWorkspacePages(query)
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.repeat) {
        if (!open && document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return
        event.preventDefault(); setQuery(''); setOpen(value => !value)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [open])

  return <>
    <button type="button" className="quick-switch-trigger" aria-label="Find a workspace section" title="Quick switch (Ctrl or Command + K)"
      onClick={() => { setQuery(''); setOpen(true) }}>
      <Search size={17} aria-hidden="true"/><span>Go to...</span><kbd>Ctrl K</kbd>
    </button>
    {open && <Modal label="Find a workspace section" onClose={() => setOpen(false)}>
      <section className="quick-switch-panel">
        <div className="quick-switch-search"><Search size={20} aria-hidden="true"/>
          <input autoFocus aria-label="Search workspace sections" aria-controls="quick-switch-results" placeholder="Where would you like to go?" value={query}
            onChange={event => setQuery(event.target.value)} onKeyDown={event => {
              if (event.key === 'ArrowDown') { event.preventDefault(); results.current?.querySelector('button')?.focus() }
              if (event.key === 'Enter' && matches.length) { event.preventDefault(); setOpen(false); onNavigate(matches[0].id) }
            }}/>
          <button type="button" aria-label="Close quick switcher" onClick={() => setOpen(false)}><X size={18}/></button>
        </div>
        <p className="quick-switch-hint">Jump to a section. Your encounter draft stays in this unlocked session.</p>
        <p className="sr-only" role="status">{matches.length} matching sections</p>
        <ul id="quick-switch-results" ref={results} onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          const buttons = Array.from(results.current?.querySelectorAll('button') ?? [])
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          if (!buttons.length) return
          event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
        }}>{matches.map(({ id, label, description, icon: Icon }) => <li key={id}>
          <button type="button" onClick={() => { setOpen(false); onNavigate(id) }}><span className="quick-switch-icon"><Icon size={20} aria-hidden="true"/></span><span><strong>{label}</strong><small>{description}</small></span><ArrowUpRight size={16} aria-hidden="true"/></button>
        </li>)}</ul>
        {!matches.length && <p className="empty-state-copy">No matching section. Try “library”, “SOAP”, or “quiz”.</p>}
        <footer>Arrow keys to browse <span>Enter to open <kbd>Esc</kbd> to close</span></footer>
      </section>
    </Modal>}
  </>
}
