import { FileText, Library, MessageSquareText, ListChecks, KeyRound } from 'lucide-react'

export const workspacePages = [
  { id: 'main', label: 'Encounter', description: 'Capture and review notes', icon: FileText, keywords: 'SOAP patient draft record' },
  { id: 'library', label: 'Library', description: 'Your saved sources', icon: Library, keywords: 'import upload notes textbook' },
  { id: 'ask', label: 'Ask sources', description: 'Find a cited answer', icon: MessageSquareText, keywords: 'search question citation evidence' },
  { id: 'quiz', label: 'Quiz', description: 'Practice what you know', icon: ListChecks, keywords: 'study test questions practice' },
  { id: 'settings', label: 'Recovery', description: 'Manage vault access', icon: KeyRound, keywords: 'settings password key' },
] as const

export type Page = (typeof workspacePages)[number]['id']

export function findWorkspacePages(query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return workspacePages.filter(page => terms.every(term =>
    `${page.label} ${page.description} ${page.keywords}`.toLowerCase().includes(term)))
}
