import { useRef, useState } from 'react'
import { ArrowUp, BookOpen, MessageSquareText, Search, ShieldCheck } from 'lucide-react'
import WorkspaceHeading from '../components/WorkspaceHeading'
import { ApiError, post } from '../api'
import type { Citation } from '../types'
import CitationView from '../components/CitationView'

interface AskResult {
  status: 'answered' | 'evidence' | 'not_covered' | 'no_match'
  answer: string
  citations: Citation[]
  evidence?: Citation[]
  model_error?: { reason: string; message: string } | null
}

export default function Ask({ onOpenLibrary }: { onOpenLibrary?: () => void }) {
  const [question, setQuestion] = useState('')
  const [scope, setScope] = useState(['notes', 'guidelines', 'textbook'])
  const [result, setResult] = useState<AskResult | null>(null)
  const [selected, setSelected] = useState<Citation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modelError, setModelError] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  async function ask(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setModelError(false); setResult(null); setSelected(null)
    try {
      const response = await post<AskResult>('/api/library/ask', { question, scope })
      setResult(response)
      if (response.model_error) {
        setModelError(true); setError(response.model_error.message)
      }
    } catch (e) {
      setModelError(e instanceof ApiError && e.code === 'model_error')
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  function sourceButton(citation: Citation) {
    return <button className="source-link btn !text-xs !py-2 text-teal-800" onClick={() => setSelected(citation)}>
      {citation.filename}, {citation.location_type === 'section' ? 'section' : 'p.'} {citation.page} · View context
    </button>
  }

  return <div className="ask-page max-w-4xl mx-auto">
    <WorkspaceHeading icon={MessageSquareText} eyebrow="ANSWERS WITH CONTEXT" title="Ask your sources" description="Explore your library, with the original passage always close by."/>
    {onOpenLibrary && !result && <div className="section-context"><span><BookOpen size={14} aria-hidden="true"/>Your library is the starting point.</span><button type="button" disabled={busy} onClick={onOpenLibrary}>Manage sources &rarr;</button></div>}
    <section className="panel ask-composer p-5">
      <fieldset className="source-scope"><legend>Search in</legend><div>
        {[['notes', 'My notes'], ['guidelines', 'Guidelines'], ['textbook', 'Textbooks']].map(([id, label]) =>
          <label key={id} className="scope-choice"><input type="checkbox" className="!w-auto accent-teal-800" disabled={busy} checked={scope.includes(id)} onChange={e => setScope(prev => e.target.checked ? [...prev, id] : prev.filter(s => s !== id))} />{label}</label>)}
      </div></fieldset>
      <form ref={form} onSubmit={ask}>
        <label htmlFor="question" className="composer-label">What would you like to explore?</label>
        <textarea id="question" rows={2} maxLength={2000} value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} placeholder="What should my chest pain presentation document?" />
        <div className="flex items-center justify-between mt-4 gap-3"><p className="text-xs text-slate-400 flex items-center gap-2"><BookOpen size={14} />Only indexed sources are searched.</p>
          <button className="btn-primary" disabled={busy || !question.trim() || !scope.length}>{busy ? 'Searching locally…' : 'Ask library'}<ArrowUp size={16} /></button>
        </div>
      </form>
    </section>

    {busy && <div role="status" className="search-progress"><Search size={18} aria-hidden="true"/><div><strong>Searching your selected sources</strong><p>Local processing can take a moment. Your answer will appear here.</p></div><progress aria-label="Searching local sources"/></div>}
    {error && <div role="alert" className="error mt-5"><p className="font-semibold">{modelError ? 'Local answer model error' : 'Local search could not be completed'}</p><p className="mt-1">{error}</p><p className="text-xs mt-2">This error does not establish whether your library covers the question.</p><button className="btn !text-xs mt-3" disabled={busy} onClick={() => form.current?.requestSubmit()}>Retry question</button></div>}

    {result?.status === 'answered' && <section className="panel result-answered p-5 mt-4" aria-live="polite">
      <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck size={18} className="text-[#287753]"/>Source-backed answer</h2>
      <p className="text-xs text-slate-500 mt-2">The complete answer text matches an indexed source passage. Relevance and coverage of your whole question still need review.</p>
      <p className="eyebrow mt-4">EXACT SOURCE EXCERPT</p><blockquote className="answer-copy whitespace-pre-wrap mt-2">{result.answer}</blockquote>
      <div className="flex flex-wrap gap-2 mt-5">{result.citations.map(c => <div key={c.chunk_id}>{sourceButton(c)}</div>)}</div>
    </section>}

    {result?.status === 'evidence' && <section className="panel result-evidence p-5 mt-4" aria-live="polite">
      <h2 className="text-sm font-semibold flex items-center gap-2"><BookOpen size={18} className="text-[#9a6717]"/>Potentially relevant source passages</h2>
      <p className="text-xs text-slate-500 mt-2">These are retrieved excerpts, not a validated answer. Matches may address only part of your question; missing details have not been supplied.</p>
      <p className="text-xs text-slate-500 mt-2">Shown using similarity and query-term matches. Relevance is uncertain; review the source context.</p>
      {result.evidence?.map(c => <article key={c.chunk_id} className="evidence-card mt-3">
        <p className="evidence-source">{c.filename} <span>· {c.location_type === 'section' ? 'section' : 'p.'} {c.page}</span></p>
        <blockquote className="whitespace-pre-wrap break-words text-sm text-slate-700 mb-3">{c.snippet}</blockquote>
        {sourceButton(c)}
      </article>)}
    </section>}

    {(result?.status === 'not_covered' || result?.status === 'no_match') && <section className="panel result-no-match p-5 mt-4" aria-live="polite">
      <h2 className="text-sm font-semibold">No confident source match</h2>
      {result.answer && <p className="text-sm mt-3">{result.answer}</p>}
      <p className="text-xs text-slate-500 mt-2">No passage met the matching checks and no source-backed answer is available. This is not proof that the information is absent. Try a more specific question or another source scope.</p>
    </section>}

    {!result && !error && !busy && <div className="question-starters"><h2 className="text-base font-medium text-slate-600">Try a question</h2><p className="text-xs text-slate-400 mt-2">Choose an example below or write your own question.</p><div className="starter-grid">{['What does SOAP stand for?', 'What chest pain details should I document?', 'What fever details should I document?'].map(sample => <button key={sample} className="starter-card" onClick={() => { setQuestion(sample); document.getElementById('question')?.focus() }}><BookOpen size={18} aria-hidden="true"/><span>{sample}</span><ArrowUp size={15} aria-hidden="true"/></button>)}</div></div>}
    {selected && <CitationView citation={selected} onClose={() => setSelected(null)} />}
  </div>
}
