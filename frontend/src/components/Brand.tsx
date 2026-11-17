/** Q for questions, an open book for knowledge, and a spark for understanding. */
export function BrandMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
  <path d="M18 2H43C46.2 2 48.6 3 50.8 5.2L58.8 13.2C61 15.4 62 17.8 62 21V46C62 56.2 56.2 62 46 62H18C7.8 62 2 56.2 2 46V18C2 7.8 7.8 2 18 2Z" fill="#102B24"/>
  <path d="M18 3H42C45.8 3 48 4 50 6L58 14C60 16 61 18.2 61 22V45C61 55.5 55.5 61 45 61H19C8.5 61 3 55.5 3 45V19C3 8.5 8.5 3 18 3Z" stroke="#A7EFCB" strokeOpacity=".18" strokeWidth="1.4"/>
  <path d="M44 15.5C40.8 13.2 36.8 12 32.6 12C21.2 12 12 21.2 12 32.6C12 44 21.2 53 32.6 53C37 53 40.7 51.8 44 49.4L51.5 55L55 50.5L46 44C49.1 40.7 51 36.7 51 32.2C51 28.2 49.9 24.7 48 21.7" stroke="#A7EFCB" strokeWidth="4.3" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M21 25.5C25.7 24.4 29.2 25.8 32.5 28.5C35.8 25.8 39.3 24.4 44 25.5V39C39.5 38 35.7 39.1 32.5 42C29.3 39.1 25.5 38 21 39V25.5Z" fill="#A7EFCB" fillOpacity=".09" stroke="#DFFBEA" strokeWidth="1.8" strokeLinejoin="round"/>
  <path d="M32.5 28.5V41" stroke="#DFFBEA" strokeWidth="1.6" strokeLinecap="round"/>
  <path d="M24 33H26L28 29.8L30 35" stroke="#A7EFCB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M35.5 31L40.5 29.8M35.5 35L40.5 33.8" stroke="#A7EFCB" strokeWidth="1.4" strokeLinecap="round"/>
  <path d="M50.5 8L52.6 12.4L57 14.5L52.6 16.6L50.5 21L48.4 16.6L44 14.5L48.4 12.4L50.5 8Z" fill="#E8C488"/>
  <path d="M44 49.4L51.5 55L55 50.5L46 44" fill="#A7EFCB"/>
  </svg>
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`brand-wordmark ${className}`} aria-label="TIBOQ">tiboq<span className="brand-spark" aria-hidden="true">.</span></span>
}
