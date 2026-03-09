import type { Motie, PartijMatch, MotieBreakdownItem, GebruikerStem } from '@/types'

export function berekenPartijMatches(
  moties: Motie[],
  gebruikerStemmen: Record<string, GebruikerStem>
): PartijMatch[] {
  const tellers: Record<string, { overeenkomsten: number; totaal: number; breakdown: MotieBreakdownItem[] }> = {}

  for (const motie of moties) {
    const gebruikerStem = gebruikerStemmen[motie.id]
    if (!gebruikerStem || gebruikerStem === 'overslaan') continue

    for (const { partij, stem } of motie.partijStemmen) {
      if (!tellers[partij]) tellers[partij] = { overeenkomsten: 0, totaal: 0, breakdown: [] }
      const eens = stem === gebruikerStem
      tellers[partij].totaal++
      if (eens) tellers[partij].overeenkomsten++
      tellers[partij].breakdown.push({ id: motie.id, titel: motie.titel, eens })
    }
  }

  return Object.entries(tellers)
    .map(([partij, { overeenkomsten, totaal, breakdown }]) => ({
      partij,
      percentage: totaal > 0 ? Math.round((overeenkomsten / totaal) * 100) : 0,
      overeenkomsten,
      totaalVergelijkbaar: totaal,
      motieBreakdown: breakdown,
    }))
    .sort((a, b) => b.percentage - a.percentage)
}
