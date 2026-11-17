import { useEffect, useRef, type ReactNode } from 'react'

/** Native modal behavior keeps keyboard focus and pointer interaction inside. */
export default function Modal({ label, onClose, children }: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [])

  return <dialog ref={dialog} aria-label={label} className="source-modal"
    onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="source-modal-surface" onClick={event => {
      if (event.target === event.currentTarget) onClose()
    }}>{children}</div>
  </dialog>
}
