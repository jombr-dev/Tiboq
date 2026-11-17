import { createRoot } from 'react-dom/client'
import App from './App'
import { initializeTheme } from './components/ThemeToggle'
initializeTheme()
createRoot(document.getElementById('root')!).render(<App />)
