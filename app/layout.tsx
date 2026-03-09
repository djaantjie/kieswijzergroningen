import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stemwijzer Groningen',
  description: 'Vergelijk jouw stemvoorkeur met de Groningse gemeenteraadsfracties',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <header className="border-b bg-background sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              Stemwijzer Groningen
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/quiz" className="hover:text-primary transition-colors">
                Quiz
              </Link>
              <Link href="/uitslag" className="hover:text-primary transition-colors">
                Uitslag
              </Link>
              <Link href="/moties" className="hover:text-primary transition-colors">
                Alle moties
              </Link>
              <Link href="/partijen" className="hover:text-primary transition-colors">
                Partijen
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
