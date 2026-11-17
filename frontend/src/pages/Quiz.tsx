import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import WorkspaceHeading from '../components/WorkspaceHeading'
import { api, post } from '../api'
import type { Citation, LibraryDocument } from '../types'
import CitationView from '../components/CitationView'

type Difficulty = 'easy' | 'medium' | 'hard'
type QuizQuestion = { id: string; question: string; options: string[]; answer_index: number; explanation: string; citation: Citation }
type QuizResult = { questions: QuizQuestion[]; requested: number; generated: number; notice: string }
const labels: Record<string, string> = { notes: 'My notes', guidelines: 'Guidelines', textbook: 'Textbooks' }

export default function Quiz({ onOpenLibrary, active = true }: { onOpenLibrary?: () => void; active?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [scope, setScope] = useState(['notes', 'guidelines', 'textbook'])
  const [documentId, setDocumentId] = useState('')
  const [quiz, setQuiz] = useState<QuizResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [position, setPosition] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState<Citation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return
    let canceled = false
    api<LibraryDocument[]>('/api/library').then(result => {
      if (canceled) return
      setDocuments(result)
      setDocumentId(previous => previous && !result.some(document => document.id === previous) ? '' : previous)
    }).catch(error => { if (!canceled) setError((error as Error).message) })
      .finally(() => { if (!canceled) setLoading(false) })
    return () => { canceled = true }
  }, [active])
  async function generate(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setQuiz(null); setSubmitted(false); setAnswers({}); setPosition(0)
    try {
      setQuiz(await post<QuizResult>('/api/quiz/generate', { topic: topic.trim(), count, difficulty, scope, document_ids: documentId ? [documentId] : [] }))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function toggleScope(id: string) {
    setScope(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id])
    setDocumentId('')
  }
  const available = documents.filter(document => scope.includes(document.tag))
  const questions = quiz?.questions ?? []
  const current = questions[position]
  const answered = questions.filter(question => answers[question.id] !== undefined).length
  const score = questions.filter(question => answers[question.id] === question.answer_index).length

  return <div className="section-page quiz-page space-y-5">
    <WorkspaceHeading tone="iris" icon={ListChecks} eyebrow="YOUR PERSONAL STUDY SESSION" title="Quiz yourself" description="Turn your own sources into a focused practice session."/>
    {!quiz && <div className="quiz-setup-layout"><section className="panel p-6"><div className="form-section-heading"><span>01</span><div><h2>Build your session</h2><p>Choose what to study and how to practice.</p></div></div><form onSubmit={generate} className="space-y-5">
      <div><label htmlFor="quiz-topic" className="field-label">Topic</label><input id="quiz-topic" className="mt-2" value={topic} maxLength={200} onChange={e => setTopic(e.target.value)} placeholder="e.g. chest pain history" disabled={busy} required /></div>
      <div className="grid sm:grid-cols-2 gap-4"><div><label htmlFor="quiz-count" className="field-label">Number of questions</label><input id="quiz-count" className="mt-2" type="number" min={1} max={20} value={count} disabled={busy} onChange={e => setCount(Number(e.target.value))}/></div><div><label htmlFor="quiz-difficulty" className="field-label">Difficulty</label><select id="quiz-difficulty" className="mt-2" value={difficulty} disabled={busy} onChange={e => setDifficulty(e.target.value as Difficulty)}><option value="easy">Easy · recall</option><option value="medium">Medium · understanding</option><option value="hard">Hard · application</option></select></div></div>
      <fieldset><legend className="field-label">Search in</legend><div className="flex flex-wrap gap-4 mt-2">{Object.entries(labels).map(([id, label]) => <label key={id} className="text-sm flex items-center gap-2"><input type="checkbox" className="!w-auto accent-teal-800" checked={scope.includes(id)} disabled={busy} onChange={() => toggleScope(id)}/>{label}</label>)}</div></fieldset>
      {available.length > 0 && <div><label htmlFor="quiz-document" className="field-label">Specific source (optional)</label><select id="quiz-document" className="mt-2" value={documentId} disabled={busy} onChange={e => setDocumentId(e.target.value)}><option value="">All selected source types</option>{available.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}</select></div>}
      <p id="quiz-prerequisite" className="text-sm text-slate-500">{loading ? 'Loading your sources...' : !scope.length ? 'Select at least one source type.' : !available.length ? 'No sources in this selection. Import a document in Library or choose another source type.' : `${available.length} sources available for this session.`}</p><p className="text-xs text-slate-500">Questions use indexed passages. If the notes cannot support the requested count, you may receive fewer questions.</p>
      <button className="btn-primary" aria-describedby="quiz-prerequisite" disabled={loading || busy || topic.trim().length < 2 || count < 1 || count > 20 || !scope.length || !available.length}><ListChecks size={16}/>{busy ? 'Creating questions locally…' : 'Create quiz'}</button>
      {busy && <progress aria-label="Creating quiz locally" className="w-full accent-teal-700"/>}
    </form></section><aside className="session-guide"><span className="guide-icon"><BookOpen size={24} aria-hidden="true"/></span><p className="eyebrow">BEFORE YOU BEGIN</p><h2>A little practice,<br/>a clearer understanding.</h2><ol><li><span>1</span><div><strong>Pick a focused topic</strong><p>A chapter or concept works better than a broad subject.</p></div></li><li><span>2</span><div><strong>Answer at your own pace</strong><p>Move between questions and change answers before submitting.</p></div></li><li><span>3</span><div><strong>Learn from the source</strong><p>Review explanations and cited passages after you submit.</p></div></li></ol></aside></div>}
    {error && <p role="alert" className="error">{error}</p>}
    {!quiz && !loading && !error && !documents.length && <p className="text-sm text-slate-500">Import notes in My library before creating a quiz. {onOpenLibrary && <button className="inline-workspace-link" onClick={onOpenLibrary}>Open Library &rarr;</button>}</p>}
    {quiz && <><div className="flex flex-wrap justify-between items-center gap-3"><p className="text-sm text-slate-600">{submitted ? `Score: ${score} / ${questions.length}` : `Question ${position + 1} of ${questions.length} · ${answered} answered`}</p><button className="btn !text-xs" onClick={() => { if (!submitted && answered > 0 && !window.confirm('Discard these quiz answers and create a new quiz?')) return; setQuiz(null); setSelected(null) }}>Create another quiz</button></div>
      {questions.length > 0 && <div className="quiz-progress"><progress aria-label="Questions answered" value={answered} max={questions.length}/><nav aria-label="Quiz questions">{questions.map((question, index) => <button type="button" key={question.id} aria-label={`Question ${index + 1}${answers[question.id] !== undefined ? ', answered' : ', unanswered'}`} aria-current={position === index ? 'step' : undefined} data-answered={answers[question.id] !== undefined} onClick={() => setPosition(index)}>{index + 1}</button>)}</nav></div>}
      {quiz.notice && <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">{quiz.notice}</p>}
      {current && <section className="panel p-6"><p className="eyebrow">QUESTION {position + 1}</p><h2 className="text-lg font-semibold mt-3 mb-5">{current.question}</h2>
        <div role="radiogroup" aria-label={`Answers for question ${position + 1}`} className="space-y-2">{current.options.map((option, index) => {
          const chosen = answers[current.id] === index
          const correct = submitted && current.answer_index === index
          return <label key={index} className={`flex items-start gap-3 rounded-xl border p-4 text-sm cursor-pointer ${correct ? 'border-teal-500 bg-teal-50' : submitted && chosen ? 'border-red-300 bg-red-50' : chosen ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}><input type="radio" name={`question-${current.id}`} className="!w-auto mt-0.5 accent-teal-800" checked={chosen} disabled={submitted} onChange={() => setAnswers(previous => ({...previous, [current.id]: index}))}/><span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span>{correct && <CheckCircle2 size={16} className="ml-auto shrink-0 text-teal-700"/>}</label>
        })}</div>
        {submitted && <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold">{answers[current.id] === current.answer_index ? 'Correct' : 'Review this answer'}</p><p className="mt-2 text-slate-600">{current.explanation}</p><button className="source-link btn !text-xs mt-3" onClick={() => setSelected(current.citation)}><BookOpen size={14}/>View source · {current.citation.filename}, {current.citation.location_type === 'section' ? 'section' : 'p.'} {current.citation.page}</button></div>}
        <div className="flex justify-between gap-3 mt-6"><button className="btn" disabled={position === 0} onClick={() => setPosition(position - 1)}><ChevronLeft size={16}/>Previous</button><button className="btn" disabled={position === questions.length - 1} onClick={() => setPosition(position + 1)}>Next<ChevronRight size={16}/></button></div>
      </section>}
      {!submitted && <div className="flex flex-wrap items-center gap-3"><button className="btn-primary" disabled={answered !== questions.length} onClick={() => {setSubmitted(true); setPosition(0)}}>Submit answers</button><p className="text-xs text-slate-500">Answer all questions to see your score and sources.</p></div>}
      {submitted && <p className="text-xs text-slate-500">These questions are study aids based on your imported text. Check the cited source for context.</p>}
    </>}
    {selected && <CitationView citation={selected} onClose={() => setSelected(null)}/>}
  </div>
}
