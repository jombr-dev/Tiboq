import { X, BookOpen } from 'lucide-react'
import Modal from './Modal'
import type { Citation } from '../types'
export default function CitationView({citation, onClose}: {citation: Citation; onClose: () => void}) {
  const at = citation.context.indexOf(citation.snippet)
  return <Modal label="Source citation" onClose={onClose}><section className="panel max-w-2xl w-full p-6 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}><div className="flex justify-between gap-4"><div><p className="eyebrow flex items-center gap-2"><BookOpen size={14}/> LOCAL SOURCE</p><h2 className="text-lg font-semibold mt-3">{citation.filename}, {citation.location_type === 'section' ? 'section' : 'p.'} {citation.page}</h2><p className="text-xs text-slate-500 mt-1">{citation.heading}</p></div><button aria-label="Close citation" className="self-start min-h-11 min-w-11 inline-flex items-center justify-center" onClick={onClose}><X size={20}/></button></div><div className="mt-6 bg-slate-50 rounded-xl p-5 text-sm leading-relaxed whitespace-pre-wrap">{at >= 0 ? <>{citation.context.slice(0, at)}<mark className="bg-amber-100 text-slate-800 rounded-sm">{citation.snippet}</mark>{citation.context.slice(at + citation.snippet.length)}</> : citation.context}</div><p className="mt-4 text-xs text-slate-400">Exact text from the indexed local document. Check its context and relevance.</p></section></Modal>
}
