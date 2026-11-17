import { useEffect, useState, type ReactNode } from 'react'

/** Mount on first visit, then retain work only within the unlocked session. */
export default function SessionPage({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  useEffect(() => { if (active) setVisited(true) }, [active])
  if (!active && !visited) return null
  return <div hidden={!active} inert={!active}>{children}</div>
}
