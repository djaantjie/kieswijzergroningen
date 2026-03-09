'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Motie, PartijMatch } from '@/types'
import { berekenPartijMatches } from '@/lib/match-engine'
import { PartijBalk } from './partij-balk'
import { Button } from '@/components/ui/button'
import { RotateCcw, List } from 'lucide-react'

const STORAGE_KEY = 'stemwijzer-quiz'

export function UitslagOverzicht({ moties }: { moties: Motie[] }) {
  const router = useRouter()
  const [matches, setMatches] = useState<PartijMatch[]>([])
  const [aantalGestemd, setAantalGestemd] = useState(0)
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        router.push('/quiz')
        return
      }
      const state = JSON.parse(raw)
      const stemmen = state.stemmen ?? {}
      const resultaat = berekenPartijMatches(moties, stemmen)
      const n = Object.values(stemmen).filter((s) => s !== 'overslaan').length
      setMatches(resultaat)
      setAantalGestemd(n as number)
    } catch {
      router.push('/quiz')
    }
    setGeladen(true)
  }, [moties, router])

  if (!geladen) return null

  if (matches.length === 0) {
    return (
      <div className="text-center space-y-4 py-12">
        <p className="text-muted-foreground">Geen resultaten gevonden. Ga terug naar de quiz.</p>
        <Button asChild>
          <Link href="/quiz">Naar de quiz</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Jouw uitslag</h1>
        <p className="text-muted-foreground text-sm">
          Gebaseerd op {aantalGestemd} moties
        </p>
      </div>

      <div className="space-y-3">
        {matches.map((match, i) => (
          <PartijBalk key={match.partij} match={match} isTop={i === 0} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 pt-4">
        <Button variant="outline" asChild>
          <Link href="/quiz">
            <RotateCcw className="size-4" />
            Opnieuw
          </Link>
        </Button>
        <Button asChild>
          <Link href="/moties">
            <List className="size-4" />
            Bekijk alle moties
          </Link>
        </Button>
      </div>
    </div>
  )
}
