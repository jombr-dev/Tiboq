import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export default function WorkspaceHeading({ icon: Icon, eyebrow, title, description, children, tone = 'sage' }: {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  tone?: 'sage' | 'ochre' | 'iris' | 'stone'
  children?: ReactNode
}) {
  return <header className="workspace-page-heading" data-tone={tone}>
    <div className="workspace-page-identity">
      <span className="workspace-page-icon"><Icon size={26} strokeWidth={1.6} aria-hidden="true"/></span>
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="workspace-page-description">{description}</p></div>
    </div>
    {children && <div className="workspace-page-actions">{children}</div>}
  </header>
}
