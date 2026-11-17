import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, LoaderCircle } from 'lucide-react'
import { api } from '../api'

export default function VoiceRecorder({ disabled, active = true, onTranscript, onError }: {
  disabled: boolean
  active?: boolean
  onTranscript: (text: string) => void
  onError: (error: unknown) => void
}) {
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [notice, setNotice] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const context = useRef<AudioContext | null>(null)
  const frame = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const request = useRef<AbortController | null>(null)
  const permissionPending = useRef(false)
  const operation = useRef(0)
  const mounted = useRef(true)
  const visible = useRef(active)
  const stopReason = useRef('')

  const releaseInput = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    cancelAnimationFrame(frame.current)
    clearInterval(timer.current)
    void context.current?.close().catch(() => {})
    context.current = null
  }, [])
  const stopCapture = useCallback((reason: string) => {
    if (recorder.current?.state !== 'recording') return
    stopReason.current = reason
    setNotice(reason)
    recorder.current.stop()
    releaseInput()
  }, [releaseInput])

  useEffect(() => {
    visible.current = active
    if (!active) stopCapture('Recording stopped when you left Encounter. Your transcript will be added to the notes.')
  }, [active, stopCapture])
  useEffect(() => {
    mounted.current = true
    function visibilityChanged() {
      if (document.hidden) stopCapture('Recording stopped when the browser tab was hidden. Your transcript will be added to the notes.')
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      mounted.current = false
      operation.current += 1
      request.current?.abort()
      if (recorder.current?.state === 'recording') recorder.current.stop()
      releaseInput()
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
  }, [releaseInput, stopCapture])

  async function start() {
    if (permissionPending.current || starting || transcribing || disabled || !active) return
    permissionPending.current = true
    const id = ++operation.current
    const current = () => mounted.current && operation.current === id
    stopReason.current = ''
    setStarting(true); setNotice('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Audio capture is unavailable. Use a current browser at http://127.0.0.1:5173 or type your notes.')
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!current() || !visible.current || document.hidden) {
        mic.getTracks().forEach(track => track.stop())
        return
      }
      stream.current = mic
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
      const capture = new MediaRecorder(mic, mime ? { mimeType: mime } : {})
      recorder.current = capture
      const chunks: Blob[] = []
      capture.ondataavailable = event => { if (current() && event.data.size) chunks.push(event.data) }
      capture.onstop = async () => {
        if (!current()) return
        releaseInput()
        setRecording(false); setLevel(0); setTranscribing(true)
        const controller = new AbortController()
        request.current = controller
        try {
          const form = new FormData()
          form.append('audio', new Blob(chunks, { type: capture.mimeType || 'audio/webm' }), 'dictation.webm')
          const result = await api<{ text: string; language: string; notice: string }>('/api/transcribe', {
            method: 'POST', body: form, signal: controller.signal,
          })
          if (current()) {
            onTranscript(result.text)
            setNotice((stopReason.current + ' Detected ' + result.language + '. ' + result.notice).trim())
          }
        } catch (error) { if (current() && !controller.signal.aborted) onError(error) }
        finally { if (current()) { setTranscribing(false); request.current = null } }
      }
      capture.onerror = () => {
        if (!current()) return
        operation.current += 1
        releaseInput(); setRecording(false); setStarting(false)
        onError(new Error('Microphone recording failed. Check the browser permission, try again, or type the encounter.'))
      }
      context.current = new AudioContext()
      const source = context.current.createMediaStreamSource(mic)
      const analyser = context.current.createAnalyser()
      analyser.fftSize = 256; source.connect(analyser)
      const values = new Uint8Array(analyser.frequencyBinCount)
      function meter() {
        if (!current()) return
        analyser.getByteTimeDomainData(values)
        const rms = Math.sqrt(values.reduce((sum, value) => sum + (value - 128) ** 2, 0) / values.length) / 128
        setLevel(Math.min(100, rms * 350))
        frame.current = requestAnimationFrame(meter)
      }
      capture.start(); setRecording(true); setSeconds(0); meter()
      let elapsed = 0
      timer.current = setInterval(() => {
        setSeconds(++elapsed)
        if (elapsed >= 120) stopCapture('Recording reached the two-minute limit.')
      }, 1000)
    } catch (error) {
      releaseInput()
      if (!current()) return
      setRecording(false)
      const name = (error as DOMException).name
      onError(new Error(name === 'NotAllowedError' ? 'Microphone permission denied. Allow the microphone for 127.0.0.1 in browser settings, or type your notes.'
        : name === 'NotFoundError' ? 'No microphone found. Type your notes or use Demo mode.' : (error as Error).message))
    } finally { permissionPending.current = false; if (current()) setStarting(false) }
  }

  return <div className="voice-recorder mb-4">
    <div className="flex gap-3 items-center">
      <button type="button" className={recording ? 'btn !border-rose-200 !text-rose-800' : 'btn !text-xs'}
        disabled={starting || transcribing || (!recording && (disabled || !active))}
        onClick={() => recording ? stopCapture('') : void start()}>
        {transcribing || starting ? <LoaderCircle size={14} className="animate-spin"/> : recording ? <Square size={14}/> : <Mic size={14}/>}
        {starting ? 'Waiting for microphone...' : transcribing ? 'Transcribing locally...' : recording ? 'Stop recording (' + seconds + 's)' : 'Dictate encounter'}
      </button>
      {recording && <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)}><div className="h-full bg-teal-500 rounded-full" style={{ width: level + '%' }}/></div>}
    </div>
    <div role="status" className="recorder-status">
      {recording ? <p>Recording locally. Stops after two minutes or when you leave this page.</p> : notice && <p>{notice}</p>}
      {transcribing && <p>Transcribing locally. You can switch sections; the text will be added to your notes.</p>}
    </div>
  </div>
}
