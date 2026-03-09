'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Motie, GebruikerStem, QuizState } from '@/types'
import { MotieKaart } from './motie-kaart'
import { VoortgangsBalk } from './voortgangs-balk'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'stemwijzer-quiz'
const MIN_STEMMEN_VOOR_UITSLAG = 5

function laadState(): QuizState {
  if (typeof window === 'undefined') {
    return { stemmen: {}, huidigIndex: 0, afgerond: false }
  }
  try {
    const opgeslagen = sessionStorage.getItem(STORAGE_KEY)
    if (opgeslagen) return JSON.parse(opgeslagen)
  } catch {}
  return { stemmen: {}, huidigIndex: 0, afgerond: false }
}

export function QuizShell({ moties: alleMoties }: { moties: Motie[] }) {
  const router = useRouter()

  // Derive available years from data
  const beschikbareJaren = useMemo(() => {
    const jaren = [...new Set(alleMoties.map((m) => m.datum.slice(0, 4)))].sort().reverse()
    return jaren
  }, [alleMoties])

  const [geselecteerdJaar, setGeselecteerdJaar] = useState<string>('alle')
  const [state, setState] = useState<QuizState>({ stemmen: {}, huidigIndex: 0, afgerond: false })
  const [geladen, setGeladen] = useState(false)

  const moties = useMemo(
    () => geselecteerdJaar === 'alle'
      ? alleMoties
      : alleMoties.filter((m) => m.datum.startsWith(geselecteerdJaar)),
    [alleMoties, geselecteerdJaar]
  )

  useEffect(() => {
    setState(laadState())
    setGeladen(true)
  }, [])

  useEffect(() => {
    if (geladen) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state, geladen])

  function wisselJaar(jaar: string) {
    setGeselecteerdJaar(jaar)
    const nieuw: QuizState = { stemmen: {}, huidigIndex: 0, afgerond: false }
    setState(nieuw)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nieuw))
  }

  const huidigeStem = (motie: Motie) => state.stemmen[motie.id]
  const aantalGestemd = Object.keys(state.stemmen).filter(
    (id) => state.stemmen[id] !== 'overslaan'
  ).length
  const huidigeMotie = moties[Math.min(state.huidigIndex, moties.length - 1)]
  const kanNaarVorige = state.huidigIndex > 0
  const kanNaarVolgende = state.huidigIndex < moties.length - 1
  const kanUitslag = aantalGestemd >= MIN_STEMMEN_VOOR_UITSLAG

  function stem(s: GebruikerStem) {
    setState((prev) => ({
      ...prev,
      stemmen: { ...prev.stemmen, [huidigeMotie.id]: s },
    }))
  }

  function naarVorige() {
    setState((prev) => ({ ...prev, huidigIndex: prev.huidigIndex - 1 }))
  }

  function naarVolgende() {
    setState((prev) => ({ ...prev, huidigIndex: prev.huidigIndex + 1 }))
  }

  function bekijkUitslag() {
    router.push('/uitslag')
  }

  function opnieuw() {
    const nieuw: QuizState = { stemmen: {}, huidigIndex: 0, afgerond: false }
    setState(nieuw)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nieuw))
  }

  if (!geladen) return null

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Jaar:</span>
        {['alle', ...beschikbareJaren].map((jaar) => (
          <button
            key={jaar}
            onClick={() => wisselJaar(jaar)}
            className={cn(
              'px-3 py-1 rounded-full text-sm border transition-colors',
              geselecteerdJaar === jaar
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            {jaar === 'alle' ? 'Alle jaren' : jaar}
          </button>
        ))}
      </div>

      <VoortgangsBalk
        huidig={state.huidigIndex}
        totaal={moties.length}
        aantalGestemd={aantalGestemd}
      />

      <MotieKaart
        motie={huidigeMotie}
        huidigeStem={huidigeStem(huidigeMotie)}
        onStem={stem}
      />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={naarVorige}
          disabled={!kanNaarVorige}
        >
          <ChevronLeft className="size-4" />
          Vorige
        </Button>

        <div className="flex items-center gap-2">
          {kanUitslag && (
            <Button onClick={bekijkUitslag} size="sm">
              <BarChart2 className="size-4" />
              Bekijk uitslag
            </Button>
          )}
          <Button onClick={opnieuw} variant="ghost" size="sm">
            Opnieuw beginnen
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={naarVolgende}
          disabled={!kanNaarVolgende}
        >
          Volgende
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {kanUitslag && (
        <p className="text-center text-sm text-muted-foreground">
          Je hebt op {aantalGestemd} moties gestemd. Je kunt nu je uitslag bekijken, of doorgaan voor meer moties.
        </p>
      )}
    </div>
  )
}
