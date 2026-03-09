import fs from 'fs'
import path from 'path'
import type { MotiesTotalData } from '@/types'
import { MotiesTabel } from '@/components/moties/moties-tabel'

function laadMoties(): MotiesTotalData {
  const p = path.join(process.cwd(), 'data', 'moties.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export default function MotiesPage() {
  const { moties } = laadMoties()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alle moties</h1>
        <p className="text-muted-foreground mt-1">
          Overzicht van alle gemeenteraadsmoties met stemresultaten per partij.
        </p>
      </div>
      <MotiesTabel moties={moties} />
    </div>
  )
}
