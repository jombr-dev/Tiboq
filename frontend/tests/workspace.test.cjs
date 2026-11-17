const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

// Render the actual components and effects in a DOM. No vault or local server is used.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://127.0.0.1:5173', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Blob', 'File', 'FormData', 'Event', 'MouseEvent', 'KeyboardEvent']) {
  global[name] = name === 'window' ? dom.window : dom.window[name]
}
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator })
global.localStorage = dom.window.localStorage
global.IS_REACT_ACT_ENVIRONMENT = true
// Audio level animation is unrelated to these lifecycle tests.
global.requestAnimationFrame = () => 1
global.cancelAnimationFrame = () => {}
window.matchMedia = () => ({ matches: false })
HTMLElement.prototype.scrollIntoView = () => {}
// JSDOM lacks native dialog presentation. Browser focus trapping still requires a browser check.
HTMLDialogElement.prototype.showModal = function () { this.open = true }
HTMLDialogElement.prototype.close = function () { this.open = false }
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename)
}
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const App = require('../src/App.tsx').default
const Recorder = require('../src/components/VoiceRecorder.tsx').default
const RecoveryKeyCard = require('../src/components/RecoveryKeyCard.tsx').default
const ReviewForm = require('../src/components/ReviewForm.tsx').default
const { blankRecord } = require('../src/types.ts')
const { api, setSession, setLockHandler } = require('../src/api.ts')

let root, host, calls, hidden, stoppedTracks, mediaRequests, transcripts, errors, sourceList
let getMicrophone, transcribe
const source = { id: 'doc-1', title: 'Fictional study notes', tag: 'notes', chunks: 1, timestamp: '2026-01-01' }
const citation = { chunk_id: 'chunk-1', filename: 'fictional.txt', page: 1, heading: '', snippet: 'Example', context: 'Example' }
const questions = [1, 2].map(number => ({ id: 'q' + number, question: 'Fictional question ' + number + '?', options: ['One', 'Two', 'Three', 'Four'], answer_index: 0, explanation: 'Example', citation }))
function json(value) { return { ok: true, status: 200, json: async () => value } }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))

class FakeRecorder {
  static instances = []
  static isTypeSupported() { return true }
  state = 'inactive'
  mimeType = 'audio/webm'
  constructor() { FakeRecorder.instances.push(this) }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['synthetic audio']) })
      this.onstop?.()
    })
  }
}
class FakeAudioContext {
  createMediaStreamSource() { return { connect() {} } }
  createAnalyser() { return { frequencyBinCount: 128, getByteTimeDomainData: values => values.fill(128) } }
  close() { return Promise.resolve() }
}

beforeEach(() => {
  document.body.innerHTML = '<div id="test-root"></div>'
  host = document.getElementById('test-root')
  root = createRoot(host)
  localStorage.clear(); setSession(null)
  calls = []; hidden = false; stoppedTracks = 0; mediaRequests = 0; transcripts = []; errors = []
  sourceList = [source]
  FakeRecorder.instances = []
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  getMicrophone = async () => ({ getTracks: () => [{ stop() { stoppedTracks++ } }] })
  transcribe = async () => json({ text: 'Synthetic transcript', language: 'en', notice: 'Check the transcript.' })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => { mediaRequests++; return getMicrophone() } } })
  global.MediaRecorder = window.MediaRecorder = FakeRecorder
  global.AudioContext = FakeAudioContext
  global.fetch = async (url, options = {}) => {
    const route = new URL(url).pathname
    calls.push({ route, options })
    if (route === '/api/status') return json({ initialized: true, recovery_configured: false, auto_lock_minutes: 5 })
    if (route === '/api/unlock') return json({ token: 'synthetic-session-' + calls.length, recovery_prompt: false })
    if (route === '/api/lock') return json({})
    if (route === '/api/session/touch') return json({})
    if (route === '/api/records') return json([])
    if (route === '/api/review') return json({ flags: [], warnings: [] })
    if (route === '/api/library') return json(sourceList)
    if (route === '/api/quiz/generate') return json({ questions, generated: 2, requested: 2, notice: '' })
    if (route === '/api/library/upload') return json({ files: [{ filename: 'fictional.txt', upload_name: 'fictional.txt', pages: 1, chunks: 1, flags: [{ id: 'flag-1', kind: 'Example identifier', text: 'Example', field: 'content' }] }] })
    if (route === '/api/transcribe') return transcribe(options.signal)
    throw new Error('Unexpected network request in test: ' + route)
  }
})
afterEach(async () => { await act(async () => { root.unmount(); await tick() }); setSession(null); setLockHandler(() => {}) })
async function mount(element) { await act(async () => { root.render(element); await tick() }) }
async function click(element) { assert.ok(element, 'Expected an element to click'); await act(async () => { element.click(); await tick() }) }
function button(text) { return [...host.querySelectorAll('button')].find(element => element.textContent.includes(text)) }
async function fill(selector, value) {
  const element = host.querySelector(selector)
  assert.ok(element, 'Expected input ' + selector)
  const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
  })
}
async function submit(form) { await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick() }) }
async function navigate(label) { await click(host.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="' + label + '"]')) }
async function unlock() { await fill('#password', 'synthetic-test-passphrase'); await submit(host.querySelector('#password').closest('form')) }

test('Ask input, Quiz answers and import review survive navigation, then clear at lock', async () => {
  await mount(React.createElement(App)); await unlock()
  assert.equal(calls.filter(call => call.route === '/api/library').length, 0, 'Unvisited sections must not load sources')
  await navigate('Ask sources'); await fill('#question', 'A question to return to')
  await navigate('Quiz'); await fill('#quiz-topic', 'Fictional study topic')
  await submit(host.querySelector('#quiz-topic').closest('form'))
  await click(host.querySelector('input[name="question-q1"]'))
  await navigate('Library')
  const input = host.querySelector('#uploads')
  await act(async () => {
    Object.defineProperty(input, 'files', { value: [new File(['Example'], 'fictional.txt', { type: 'text/plain' })] })
    input.dispatchEvent(new Event('change', { bubbles: true })); await tick()
  })
  await click(button('Review files before indexing'))
  await click(host.querySelector('[aria-label="Decision for Example"] button'))
  await navigate('Ask sources')
  assert.equal(host.querySelector('#question').value, 'A question to return to')
  assert.ok(host.querySelector('#quiz-topic') === null, 'Generated quiz replaces its setup form')
  assert.ok(host.querySelector('.quiz-page').closest('[hidden][inert]'), 'Inactive pages are hidden and inert')
  await navigate('Quiz'); assert.equal(host.querySelector('input[name="question-q1"]').checked, true)
  await navigate('Library'); assert.equal(host.querySelector('[aria-label="Decision for Example"] button').getAttribute('aria-pressed'), 'true')
  assert.equal(host.querySelector('#uploads').files.length, 1)
  await click(button('Lock vault'))
  assert.equal(host.querySelector('#question'), null); assert.equal(host.querySelector('#uploads'), null)
  await unlock(); await navigate('Ask sources'); assert.equal(host.querySelector('#question').value, '')
  await navigate('Quiz'); assert.equal(host.querySelector('#quiz-topic').value, '')
  await navigate('Library'); assert.equal(host.querySelector('#uploads').files.length, 0)
  assert.equal(localStorage.length, 0, 'Unsaved content must not be written to browser storage')
})

function recorder(active = true) { return React.createElement(Recorder, { active, disabled: false, onTranscript: text => transcripts.push(text), onError: error => errors.push(error) }) }
test('Leaving Encounter stops microphone tracks and retains the resulting transcript', async () => {
  await mount(recorder()); await click(button('Dictate encounter'))
  assert.equal(FakeRecorder.instances[0].state, 'recording')
  await mount(recorder(false))
  assert.equal(FakeRecorder.instances[0].state, 'inactive'); assert.ok(stoppedTracks > 0)
  assert.deepEqual(transcripts, ['Synthetic transcript']); assert.equal(errors.length, 0)
  assert.match(host.textContent, /Recording stopped when you left Encounter/)
})
test('Late microphone permission after leaving releases the stream without recording', async () => {
  const permission = deferred(); getMicrophone = () => permission.promise
  await mount(recorder()); await click(button('Dictate encounter')); await mount(recorder(false))
  await act(async () => { permission.resolve({ getTracks: () => [{ stop() { stoppedTracks++ } }] }); await tick() })
  assert.equal(stoppedTracks, 1); assert.equal(FakeRecorder.instances.length, 0)
  assert.equal(calls.filter(call => call.route === '/api/transcribe').length, 0)
})
test('Repeated clicks while waiting for microphone permission make one request', async () => {
  const permission = deferred(); getMicrophone = () => permission.promise
  await mount(recorder()); await click(button('Dictate encounter'))
  await click(button('Waiting for microphone'))
  assert.equal(mediaRequests, 1)
  await act(async () => { permission.resolve({ getTracks: () => [{ stop() { stoppedTracks++ } }] }); await tick() })
  assert.equal(FakeRecorder.instances.length, 1)
})
test('Hiding the browser tab stops microphone recording', async () => {
  await mount(recorder()); await click(button('Dictate encounter'))
  await act(async () => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); await tick() })
  assert.ok(stoppedTracks > 0); assert.equal(FakeRecorder.instances[0].state, 'inactive')
})
test('A stale recorder stop event does not stop a new capture', async () => {
  await mount(recorder()); await click(button('Dictate encounter'))
  const previous = FakeRecorder.instances[0]
  await act(async () => { previous.state = 'inactive'; previous.onerror(); await tick() })
  await click(button('Dictate encounter'))
  const before = stoppedTracks
  await act(async () => { await previous.onstop(); await tick() })
  assert.equal(FakeRecorder.instances[1].state, 'recording')
  assert.equal(stoppedTracks, before)
})
test('Unmounting on lock aborts transcription and ignores a late response', async () => {
  const pending = deferred(); let signal
  transcribe = requestSignal => { signal = requestSignal; return pending.promise }
  await mount(recorder()); await click(button('Dictate encounter')); await click(button('Stop recording'))
  await mount(null); assert.equal(signal.aborted, true)
  await act(async () => { pending.resolve(json({ text: 'Late text', language: 'en', notice: '' })); await tick() })
  assert.equal(transcripts.length, 0); assert.equal(errors.length, 0)
})
test('Recovery dialog focuses its heading and cannot dismiss the one-time key prematurely', async () => {
  let done = false
  function RecoveryExample() {
    const [show, setShow] = React.useState(true)
    return show ? React.createElement(RecoveryKeyCard, { recoveryKey: 'SYNTHETIC-KEY-FOR-TESTING', onDone: () => { done = true; setShow(false) } }) : null
  }
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
  await mount(React.createElement(RecoveryExample))
  const dialog = host.querySelector('dialog')
  assert.ok(dialog.open); assert.equal(document.activeElement, host.querySelector('[data-modal-heading]'))
  const escape = new Event('cancel', { cancelable: true })
  await act(async () => { dialog.dispatchEvent(escape); host.querySelector('.source-modal-surface').click(); await tick() })
  assert.ok(escape.defaultPrevented); assert.ok(dialog.open); assert.equal(button('Continue').disabled, true); assert.equal(done, false)
  await click(host.querySelector('input[type="checkbox"]')); await click(button('Continue'))
  assert.equal(done, true); assert.equal(host.querySelector('dialog'), null); assert.equal(document.activeElement, trigger)
})
test('SOAP opens sections needing review, collapses empty sections, and retains edits when toggled', async () => {
  const record = blankRecord(); record.hpi = 'Fictional history'
  await mount(React.createElement(ReviewForm, { record, pending: new Set(['hpi']), warnings: [], onConfirm() {}, onChange() {} }))
  assert.ok(host.querySelector('.review-group-subjective').open)
  assert.equal(host.querySelector('.review-group-assessment').open, false)
  await click(host.querySelector('.review-group-subjective summary'))
  assert.equal(host.querySelector('.review-group-subjective').open, false)
  await click(host.querySelector('.review-group-subjective summary'))
  assert.equal(host.querySelector('#hpi').value, 'Fictional history')
})
test('Locking during a batch import prevents the next file from being indexed', async () => {
  const firstImport = deferred(); let indexed = 0
  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    if (new URL(url).pathname !== '/api/library/upload') return originalFetch(url, options)
    if (options.body.get('proceed') === 'true') { indexed++; return firstImport.promise }
    return json({ files: ['one.txt', 'two.txt'].map(name => ({ filename: name, upload_name: name, pages: 1, chunks: 1, flags: [] })) })
  }
  await mount(React.createElement(App)); await unlock(); await navigate('Library')
  const input = host.querySelector('#uploads')
  await act(async () => {
    Object.defineProperty(input, 'files', { value: ['one.txt', 'two.txt'].map(name => new File(['Example'], name, { type: 'text/plain' })) })
    input.dispatchEvent(new Event('change', { bubbles: true })); await tick()
  })
  await click(button('Review files before indexing')); await click(button('Proceed and index'))
  assert.equal(indexed, 1)
  await click(button('Lock vault')); await unlock()
  await act(async () => { firstImport.resolve(json({})); await tick() })
  assert.equal(indexed, 1, 'A locked session must not start another upload')
})
test('A late unauthorized response from an old session cannot lock a newly unlocked session', async () => {
  const response = deferred(); let locked = 0
  global.fetch = () => response.promise
  setLockHandler(() => { locked++ }); setSession('synthetic-old-session')
  const oldRequest = api('/api/library')
  setSession('synthetic-new-session')
  response.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Expired session' }) })
  await assert.rejects(oldRequest)
  assert.equal(locked, 0)
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ detail: 'Expired session' }) })
  await assert.rejects(api('/api/library'))
  assert.equal(locked, 1, 'The current session still locks on an unauthorized response')
})
test('Returning to Quiz refreshes sources and clears a removed document selection', async () => {
  await mount(React.createElement(App)); await unlock(); await navigate('Quiz')
  await act(async () => {
    const select = host.querySelector('#quiz-document')
    select.value = 'doc-1'; select.dispatchEvent(new Event('change', { bubbles: true })); await tick()
  })
  await fill('#quiz-topic', 'Keep this topic')
  await navigate('Library')
  sourceList = [{ ...source, id: 'doc-2', title: 'Replacement source' }]
  await navigate('Quiz')
  assert.equal(host.querySelector('#quiz-topic').value, 'Keep this topic')
  assert.equal(host.querySelector('#quiz-document').value, '')
  assert.match(host.querySelector('#quiz-document').textContent, /Replacement source/)
  assert.ok(!host.querySelector('#quiz-document option[value="doc-1"]'))
  await navigate('Library')
  assert.match(host.querySelector('.source-row').textContent, /Replacement source/)
})
