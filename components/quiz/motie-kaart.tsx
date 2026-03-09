'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Minus, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import type { Motie, GebruikerStem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MotieKaartProps {
  motie: Motie
  huidigeStem: GebruikerStem | undefined
  onStem: (stem: GebruikerStem) => void
}

const knoppen: { stem: GebruikerStem; label: string; icon: React.ReactNode; kleur: string }[] = [
  {
    stem: 'voor',
    label: 'Voor',
    icon: <ThumbsUp className="size-5" />,
    kleur: 'text-green-700 border-green-300 hover:bg-green-50 data-[actief=true]:bg-green-600 data-[actief=true]:text-white data-[actief=true]:border-green-600',
  },
  {
    stem: 'overslaan',
    label: 'Overslaan',
    icon: <Minus className="size-5" />,
    kleur: 'text-muted-foreground border-border hover:bg-accent data-[actief=true]:bg-secondary data-[actief=true]:text-secondary-foreground',
  },
  {
    stem: 'tegen',
    label: 'Tegen',
    icon: <ThumbsDown className="size-5" />,
    kleur: 'text-red-600 border-red-300 hover:bg-red-50 data-[actief=true]:bg-red-600 data-[actief=true]:text-white data-[actief=true]:border-red-600',
  },
]

export function MotieKaart({ motie, huidigeStem, onStem }: MotieKaartProps) {
  const [argumentenOpen, setArgumentenOpen] = useState(false)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardDescription>
          {new Date(motie.datum).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {motie.indieners.length > 0 && (
            <span className="ml-2">· Ingediend door {motie.indieners.join(', ')}</span>
          )}
        </CardDescription>
        <CardTitle className="text-xl leading-snug">{motie.titel}</CardTitle>
        {motie.samenvatting && (
          <p className="text-sm text-muted-foreground leading-relaxed">{motie.samenvatting}</p>
        )}
        {motie.pdfUrl && (
          <a
            href={motie.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="size-4" />
            Bekijk motie (PDF)
          </a>
        )}
        {motie.argumenten && (
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setArgumentenOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <span>Argumenten voor &amp; tegen</span>
              {argumentenOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {argumentenOpen && (
              <div className="divide-y">
                <div className="px-3 py-2.5 bg-green-50">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Voor</p>
                  <p className="text-sm text-green-900 leading-relaxed">{motie.argumenten.voor}</p>
                </div>
                <div className="px-3 py-2.5 bg-red-50">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Tegen</p>
                  <p className="text-sm text-red-900 leading-relaxed">{motie.argumenten.tegen}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 justify-center pt-2">
          {knoppen.map(({ stem, label, icon, kleur }) => (
            <button
              key={stem}
              data-actief={huidigeStem === stem}
              onClick={() => onStem(stem)}
              className={cn(
                'flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 font-medium transition-all flex-1 max-w-36',
                kleur
              )}
            >
              {icon}
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
