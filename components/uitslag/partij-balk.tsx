'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { PartijMatch } from '@/types'
import { cn } from '@/lib/utils'

export function PartijBalk({
  match,
  isTop,
}: {
  match: PartijMatch
  isTop: boolean
}) {
  const [open, setOpen] = useState(false)
  const { partij, percentage, overeenkomsten, totaalVergelijkbaar, motieBreakdown } = match

  const eens = motieBreakdown.filter((m) => m.eens)
  const oneens = motieBreakdown.filter((m) => !m.eens)

  return (
    <div
      className={cn(
        'rounded-xl border space-y-2',
        isTop && 'border-primary/30 bg-primary/5'
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 space-y-2"
      >
        <div className="flex items-center justify-between">
          <span className={cn('font-semibold', isTop && 'text-primary')}>
            {partij}
            {isTop && (
              <span className="ml-2 text-xs font-normal text-primary/70">Beste match</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-2xl font-bold tabular-nums',
                percentage >= 60 ? 'text-green-600' : percentage >= 40 ? 'text-amber-600' : 'text-red-600'
              )}
            >
              {percentage}%
            </span>
            {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </div>
        </div>

        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              percentage >= 60 ? 'bg-green-500' : percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {overeenkomsten} van {totaalVergelijkbaar} moties overeenkomen
        </p>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          {eens.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Eens ({eens.length})
              </p>
              <ul className="space-y-1">
                {eens.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 text-sm">
                    <ThumbsUp className="size-3.5 text-green-600 mt-0.5 shrink-0" />
                    <Link href={`/moties/${m.id}`} className="hover:underline text-foreground">
                      {m.titel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {oneens.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                Oneens ({oneens.length})
              </p>
              <ul className="space-y-1">
                {oneens.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 text-sm">
                    <ThumbsDown className="size-3.5 text-red-500 mt-0.5 shrink-0" />
                    <Link href={`/moties/${m.id}`} className="hover:underline text-foreground">
                      {m.titel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
