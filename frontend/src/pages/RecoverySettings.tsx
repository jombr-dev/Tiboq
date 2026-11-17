import { useState } from 'react'
import { KeyRound, RefreshCw, ShieldCheck, EyeOff, FolderLock } from 'lucide-react'
import WorkspaceHeading from '../components/WorkspaceHeading'
import { post } from '../api'
import RecoveryKeyCard from '../components/RecoveryKeyCard'

interface RecoveryResponse { configured: boolean; recovery_key: string | null }

export default function RecoverySettings({ configured, refresh }: { configured: boolean; refresh: () => void }) {
  const [password, setPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true); setError('')
    try {
      const result = await post<RecoveryResponse>('/api/vault/recovery/setup', {enabled: true})
      setRecoveryKey(result.recovery_key ?? '')
      refresh()
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }

  async function regenerate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await post<RecoveryResponse>('/api/vault/recovery/regenerate', {current_password: password})
      setPassword('')
      setRecoveryKey(result.recovery_key ?? '')
      refresh()
    } catch (failure) { setError((failure as Error).message); setPassword('') }
    finally { setBusy(false) }
  }

  return <div className="section-page recovery-page">
    <WorkspaceHeading tone="stone" icon={KeyRound} eyebrow="VAULT ACCESS" title="Recovery key" description="Keep a separate way to unlock your vault if you forget its password."/>
    <div className="recovery-layout"><div>
    <section className="panel mt-6 p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800"><KeyRound size={19}/></div>
        <div>
          <h2 className="text-lg font-semibold">{configured ? 'Recovery is configured' : 'No recovery key configured'}</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{configured
            ? 'Regenerating immediately invalidates the old recovery key and requires your current password.'
            : 'Create a recovery key to reset a forgotten password. You will still need access to your encrypted vault file.'}</p>
        </div>
      </div>
      {error && <p role="alert" className="error mt-5">{error}</p>}
      {!recoveryKey && (configured
        ? <form className="mt-6 space-y-4" onSubmit={regenerate}>
            <div><label className="field-label" htmlFor="recovery-current-password">Current vault password</label><input className="mt-2" disabled={busy} id="recovery-current-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)}/></div>
            <button className="btn-primary" disabled={busy || !password}><RefreshCw size={15}/>{busy ? 'Regenerating…' : 'Regenerate recovery key'}</button>
          </form>
        : <button type="button" className="btn-primary mt-6" disabled={busy} onClick={create}><KeyRound size={15}/>{busy ? 'Generating…' : 'Create recovery key'}</button>)}
      {recoveryKey && <div className="mt-6"><RecoveryKeyCard recoveryKey={recoveryKey} title={configured ? 'Your new recovery key' : 'Your recovery key'} onDone={() => {setRecoveryKey(''); refresh()}}/></div>}
    </section>
    </div><aside className="recovery-guide"><h2>Keep your recovery path safe</h2><div><ShieldCheck size={20} aria-hidden="true"/><section><h3>Store it separately</h3><p>Keep the key somewhere private, away from this device.</p></section></div><div><EyeOff size={20} aria-hidden="true"/><section><h3>One-time display</h3><p>Copy or print the key when it appears. It cannot be displayed again.</p></section></div><div><FolderLock size={20} aria-hidden="true"/><section><h3>Access is not a backup</h3><p>A recovery key unlocks an existing vault. It does not restore a lost vault file or device.</p></section></div></aside></div>
  </div>
}
