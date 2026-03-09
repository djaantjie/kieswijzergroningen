'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Motie } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function MotiesTabel({ moties }: { moties: Motie[] }) {
  const jaren = [...new Set(moties.map((m) => m.datum.slice(0, 4)))].sort().reverse()
  const [filterJaar, setFilterJaar] = useState<string>('alle')

  const gefilterd = filterJaar === 'alle'
    ? moties
    : moties.filter((m) => m.datum.startsWith(filterJaar))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter op jaar:</span>
        {['alle', ...jaren].map((jaar) => (
          <button
            key={jaar}
            onClick={() => setFilterJaar(jaar)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              filterJaar === jaar
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent border-border'
            }`}
          >
            {jaar === 'alle' ? 'Alle jaren' : jaar}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{gefilterd.length} moties</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Motie</TableHead>
            <TableHead>Ingediend door</TableHead>
            <TableHead>Uitslag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gefilterd.map((motie) => (
            <TableRow key={motie.id} className="cursor-pointer">
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {new Date(motie.datum).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell className="max-w-xs">
                <Link
                  href={`/moties/${encodeURIComponent(motie.id)}`}
                  className="hover:underline font-medium line-clamp-2 whitespace-normal"
                >
                  {motie.titel}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-normal max-w-48">
                {motie.indieners.join(', ') || '—'}
              </TableCell>
              <TableCell>
                {motie.aangenomen === true && (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                    Aangenomen
                  </Badge>
                )}
                {motie.aangenomen === false && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                    Verworpen
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
