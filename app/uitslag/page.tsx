import fs from 'fs'
import path from 'path'
import type { MotiesTotalData } from '@/types'
import { UitslagOverzicht } from '@/components/uitslag/uitslag-overzicht'

function laadMoties(): MotiesTotalData {
  const p = path.join(process.cwd(), 'data', 'moties.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export default function UitslagPage() {
  const { moties } = laadMoties()
  return <UitslagOverzicht moties={moties} />
}
