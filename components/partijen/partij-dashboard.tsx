'use client'

import { useState } from 'react'
import type { Motie } from '@/types'
import {
  berekenSimilariteitsMatrix,
  berekenPartijStats,
  berekenJaarData,
  berekenCoalitiepatronen,
} from '@/lib/partij-analytics'
import { cn } from '@/lib/utils'

function pctKleur(pct: number): string {
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 60) return 'bg-green-300'
  if (pct >= 45) return 'bg-amber-300'
  if (pct >= 30) return 'bg-orange-300'
  return 'bg-red-400'
}

function pctTekstKleur(pct: number): string {
  if (pct >= 75) return 'text-white'
  return 'text-gray-900'
}

type Tab = 'matrix' | 'stats' | 'coalitie' | 'tijdlijn'

export function PartijDashboard({ moties }: { moties: Motie[] }) {
  const [tab, setTab] = useState<Tab>('matrix')

  const similariteit = berekenSimilariteitsMatrix(moties)
  const stats = berekenPartijStats(moties, similariteit)
  const jaarData = berekenJaarData(moties)
  const coalitie = berekenCoalitiepatronen(similariteit, 20)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'matrix', label: 'Gelijkenismatrix' },
    { id: 'stats', label: 'Partij-overzicht' },
    { id: 'coalitie', label: 'Coalitiepatronen' },
    { id: 'tijdlijn', label: 'Tijdlijn per jaar' },
  ]

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Similarity matrix */}
      {tab === 'matrix' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Percentage moties waarop twee partijen hetzelfde stemden (alleen 2019–2025, minimaal 20 gezamenlijke moties).
          </p>
          <div className="overflow-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-1 text-left font-normal text-muted-foreground min-w-28">Partij</th>
                  {similariteit.partijen.map((p) => (
                    <th
                      key={p}
                      className="p-1 font-normal"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 100 }}
                    >
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {similariteit.partijen.map((partijA, i) => (
                  <tr key={partijA}>
                    <td className="p-1 font-medium pr-2 whitespace-nowrap">{partijA}</td>
                    {similariteit.partijen.map((_, j) => {
                      const pct = similariteit.matrix[i][j]
                      const gedeeld = similariteit.aantalGedeeld[i][j]
                      if (i === j) {
                        return <td key={j} className="w-8 h-8 bg-muted/40" />
                      }
                      if (gedeeld < 20) {
                        return (
                          <td key={j} className="w-8 h-8 text-center text-muted-foreground/30">
                            –
                          </td>
                        )
                      }
                      return (
                        <td
                          key={j}
                          title={`${partijA} & ${similariteit.partijen[j]}: ${pct}% (${gedeeld} moties)`}
                          className={cn('w-8 h-8 text-center font-semibold cursor-default', pctKleur(pct), pctTekstKleur(pct))}
                        >
                          {pct}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>Legenda:</span>
            {[
              { label: '≥75%', cls: 'bg-green-500' },
              { label: '60–74%', cls: 'bg-green-300' },
              { label: '45–59%', cls: 'bg-amber-300' },
              { label: '30–44%', cls: 'bg-orange-300' },
              { label: '<30%', cls: 'bg-red-400' },
            ].map(({ label, cls }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={cn('inline-block w-4 h-4 rounded', cls)} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2. Party stats cards */}
      {tab === 'stats' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats
            .sort((a, b) => b.totaalGestemd - a.totaalGestemd)
            .map((s) => (
              <div key={s.partij} className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{s.partij}</span>
                  <span className="text-sm text-muted-foreground">{s.totaalGestemd} moties</span>
                </div>
                {/* Voor/Tegen split bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Voor {s.pctVoor}%</span>
                    <span>Tegen {100 - s.pctVoor}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-red-200 flex">
                    <div
                      className="h-full bg-green-500 rounded-l-full"
                      style={{ width: `${s.pctVoor}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded p-2">
                    <p className="text-muted-foreground">Meest mee eens</p>
                    <p className="font-medium mt-0.5 truncate">{s.besteMatch || '–'}</p>
                  </div>
                  <div className="bg-muted rounded p-2">
                    <p className="text-muted-foreground">Minst mee eens</p>
                    <p className="font-medium mt-0.5 truncate">{s.slechsteMatch || '–'}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Effectiviteit:{' '}
                  <span className="font-medium text-foreground">{s.effectiviteit}%</span>
                  <span className="ml-1">(aangenomen van moties waarvoor gestemd)</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 3. Coalition patterns */}
      {tab === 'coalitie' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Partijparen gerangschikt op stemovereenkomst (minimaal 20 gezamenlijke moties, 2019–2025).
          </p>
          <div className="space-y-2">
            {coalitie.map(({ partijA, partijB, pct, aantalGedeeld }) => (
              <div key={`${partijA}-${partijB}`} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {partijA} <span className="text-muted-foreground">&amp;</span> {partijB}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold tabular-nums ml-2 shrink-0',
                        pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                      )}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', pctKleur(pct))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{aantalGedeeld} moties samen gestemd</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Year timeline */}
      {tab === 'tijdlijn' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Per jaar en per partij: aantal moties gestemd en percentage voor-stemmen.
          </p>
          <div className="overflow-auto">
            {jaarData.map(({ jaar, partijen: jPartijen }) => {
              const allePartijen = Object.entries(jPartijen).sort((a, b) => b[1].totaal - a[1].totaal)
              return (
                <div key={jaar} className="mb-6">
                  <h3 className="font-semibold text-base mb-2">{jaar}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {allePartijen.map(([partij, { voor, totaal }]) => {
                      const pct = totaal > 0 ? Math.round((voor / totaal) * 100) : 0
                      return (
                        <div key={partij} className="border rounded-lg p-2 text-xs">
                          <p className="font-medium truncate" title={partij}>{partij}</p>
                          <p className="text-muted-foreground">{totaal} moties</p>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-muted-foreground">{pct}% voor</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
