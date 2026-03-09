import fs from 'fs'
import path from 'path'
import type { MotiesTotalData } from '@/types'
import { PartijDashboard } from '@/components/partijen/partij-dashboard'

function laadMoties(): MotiesTotalData {
  const p = path.join(process.cwd(), 'data', 'moties.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export default function PartijPage() {
  const { moties } = laadMoties()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Partijen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Stemgedrag, gelijkenis en coalitiepatronen van Groningse raadsfracties (2010–2025)
        </p>
      </div>
      <PartijDashboard moties={moties} />
    </div>
  )
}
