import { Check, UserRound } from 'lucide-react'
import type { RecordDraft, Warning } from '../types'
export const fields = [
  ['patient.age', 'Age (years)', 'number'], ['patient.sex', 'Sex as stated', 'text'],
  ['chief_complaint', 'Chief complaint', 'text'], ['hpi', 'History of present illness', 'area'],
  ['past_history', 'Past history', 'area'], ['medications', 'Medications · one per line', 'list'],
  ['allergies', 'Allergies · one per line', 'list'], ['vitals.bp', 'BP (mmHg)', 'text'],
  ['vitals.hr', 'Heart rate (bpm)', 'number'], ['vitals.rr', 'Resp. rate (/min)', 'number'],
  ['vitals.temp_c', 'Temperature (°C)', 'number'], ['vitals.spo2', 'SpO₂ (%)', 'number'],
  ['physical_exam', 'Physical examination', 'area'], ['assessment', 'Assessment as stated', 'area'], ['plan', 'Plan as stated', 'area'],
] as const
export function valueAt(record: RecordDraft, path: string): string {
  const [a, b] = path.split('.')
  const top = record[a as keyof RecordDraft]
  const value = b ? (top as unknown as { [key: string]: unknown })[b] : top
  return Array.isArray(value) ? value.join('\n') : value === null ? '' : String(value)
}
export function updateAt(record: RecordDraft, path: string, raw: string, kind: string): RecordDraft {
  const result = structuredClone(record)
  const value = kind === 'list' ? raw.split('\n').filter(x => x.trim()) : raw === '' ? null : kind === 'number' ? Number(raw) : raw
  const [a, b] = path.split('.')
  if (b) (result[a as keyof RecordDraft] as unknown as { [key: string]: unknown })[b] = value
  else (result as unknown as { [key: string]: unknown })[a] = value
  return result
}
const groups = [
  { letter: '', title: 'Patient details', note: 'As stated in the encounter', paths: ['patient.age', 'patient.sex'], className: 'review-group-patient' },
  { letter: 'S', title: 'Subjective', note: 'Reported history and symptoms', paths: ['chief_complaint', 'hpi', 'past_history', 'medications', 'allergies'], className: 'review-group-subjective' },
  { letter: 'O', title: 'Objective', note: 'Measured and observed findings', paths: ['vitals.bp', 'vitals.hr', 'vitals.rr', 'vitals.temp_c', 'vitals.spo2', 'physical_exam'], className: 'review-group-objective' },
  { letter: 'A', title: 'Assessment', note: 'Only what was explicitly stated', paths: ['assessment'], className: 'review-group-assessment' },
  { letter: 'P', title: 'Plan', note: 'Only what was explicitly stated', paths: ['plan'], className: 'review-group-plan' },
]
export default function ReviewForm({ record, onChange, pending, onConfirm, warnings }: {
  record: RecordDraft; onChange: (record: RecordDraft, path: string) => void; pending: Set<string>
  onConfirm: (path: string) => void; warnings: Warning[]
}) {
  function renderField([path, label, kind]: (typeof fields)[number]) {
    const highlighted = pending.has(path)
    return <div key={path} className={highlighted ? 'review-field ai-field' : 'review-field'}>
      <div className="flex items-center justify-between gap-2 mb-2"><label htmlFor={path} className="field-label">{label}</label>
        {highlighted && <button type="button" aria-label={`Mark ${label} as reviewed`} title={`Mark ${label} as reviewed`} className="review-confirm-icon" onClick={() => onConfirm(path)}><Check size={16} strokeWidth={2.4} aria-hidden="true"/></button>}</div>
      {kind === 'area' || kind === 'list' ? <textarea id={path} aria-describedby={warnings.some(w => w.field === path) ? `${path}-warnings` : undefined} rows={kind === 'area' ? 3 : 2} value={valueAt(record, path)} placeholder="Not stated" onChange={e => onChange(updateAt(record, path, e.target.value, kind), path)} />
        : <input id={path} aria-describedby={warnings.some(w => w.field === path) ? `${path}-warnings` : undefined} type={kind === 'number' ? 'number' : 'text'} step="any" value={valueAt(record, path)} placeholder="Not stated" onChange={e => onChange(updateAt(record, path, e.target.value, kind), path)} />}
      <div id={`${path}-warnings`}>{warnings.filter(w => w.field === path).map((w, i) => <p key={i} className="mt-2 text-xs text-amber-800">{w.message}</p>)}</div>
    </div>
  }
  return <div className="review-groups soap-draft">{groups.map(group => {
    const groupFields = fields.filter(([path]) => group.paths.includes(path))
    const remaining = groupFields.filter(([path]) => pending.has(path)).length
    const populated = groupFields.some(([path]) => valueAt(record, path).trim())
    return <section key={group.title} className={`review-group ${group.className}`} aria-label={group.title}>
      <div className="review-group-heading">
        <div className="soap-section-identity">
          <span className="soap-section-letter" aria-hidden="true">{group.letter || <UserRound size={18}/>}</span>
          <div><h3>{group.title}</h3><p>{group.note}</p></div>
        </div>
        {remaining > 0 ? <span className="soap-review-count">{remaining} to review</span>
          : <span className="soap-section-status">{populated ? <><Check size={13} aria-hidden="true"/>Reviewed</> : 'Not stated'}</span>}
      </div>
      <div className="review-group-fields">{groupFields.map(renderField)}</div>
    </section>
  })}</div>
}
