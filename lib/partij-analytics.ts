import type { Motie } from '@/types'

export interface PartijStats {
  partij: string
  totaalGestemd: number
  aantalVoor: number
  aantalTegen: number
  pctVoor: number
  // % of moties they voted FOR that were adopted
  effectiviteit: number
  besteMatch: string
  slechsteMatch: string
}

export interface SimilariteitsMatrix {
  partijen: string[]
  matrix: number[][] // matrix[i][j] = % overeenkomst tussen partijen[i] en partijen[j]
  aantalGedeeld: number[][] // hoeveel moties ze allebei gestemd hebben
}

export interface JaarData {
  jaar: string
  partijen: Record<string, { voor: number; tegen: number; totaal: number }>
}

export interface CoalitiePaar {
  partijA: string
  partijB: string
  pct: number
  aantalGedeeld: number
}

// Compute pairwise similarity between all parties
export function berekenSimilariteitsMatrix(moties: Motie[]): SimilariteitsMatrix {
  // Collect all parties that appear in recent data (2019+)
  const partijSet = new Set<string>()
  for (const m of moties) {
    if (m.datum >= '2019-01-01') {
      for (const s of m.partijStemmen) partijSet.add(s.partij)
    }
  }
  const partijen = [...partijSet].sort()
  const n = partijen.length
  const idx = Object.fromEntries(partijen.map((p, i) => [p, i]))

  const overeenkomsten = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const gedeeld = Array.from({ length: n }, () => new Array<number>(n).fill(0))

  for (const m of moties) {
    if (m.partijStemmen.length < 2) continue
    const stemMap = new Map(m.partijStemmen.map((s) => [s.partij, s.stem]))
    const aanwezig = m.partijStemmen.map((s) => s.partij).filter((p) => idx[p] !== undefined)
    for (let a = 0; a < aanwezig.length; a++) {
      for (let b = a + 1; b < aanwezig.length; b++) {
        const i = idx[aanwezig[a]]
        const j = idx[aanwezig[b]]
        if (i === undefined || j === undefined) continue
        gedeeld[i][j]++
        gedeeld[j][i]++
        if (stemMap.get(aanwezig[a]) === stemMap.get(aanwezig[b])) {
          overeenkomsten[i][j]++
          overeenkomsten[j][i]++
        }
      }
    }
    // diagonal
    for (const p of aanwezig) {
      const i = idx[p]
      if (i !== undefined) {
        overeenkomsten[i][i]++
        gedeeld[i][i]++
      }
    }
  }

  const matrix = overeenkomsten.map((row, i) =>
    row.map((val, j) => (gedeeld[i][j] > 0 ? Math.round((val / gedeeld[i][j]) * 100) : 0))
  )

  return { partijen, matrix, aantalGedeeld: gedeeld }
}

// Per-party vote statistics
export function berekenPartijStats(
  moties: Motie[],
  similariteit: SimilariteitsMatrix
): PartijStats[] {
  const { partijen, matrix } = similariteit

  return partijen.map((partij, i) => {
    let totaal = 0
    let voor = 0
    let aangenomenVoor = 0
    let totaalVoorAangenomen = 0

    for (const m of moties) {
      const stem = m.partijStemmen.find((s) => s.partij === partij)
      if (!stem) continue
      totaal++
      if (stem.stem === 'voor') {
        voor++
        if (m.aangenomen !== null) {
          totaalVoorAangenomen++
          if (m.aangenomen) aangenomenVoor++
        }
      }
    }

    // Best/worst match from similarity matrix (excluding self)
    let besteScore = -1
    let slechtsteScore = 101
    let besteMatch = ''
    let slechsteMatch = ''
    for (let j = 0; j < partijen.length; j++) {
      if (j === i) continue
      const pct = matrix[i][j]
      if (pct > besteScore) { besteScore = pct; besteMatch = partijen[j] }
      if (pct < slechtsteScore) { slechtsteScore = pct; slechsteMatch = partijen[j] }
    }

    return {
      partij,
      totaalGestemd: totaal,
      aantalVoor: voor,
      aantalTegen: totaal - voor,
      pctVoor: totaal > 0 ? Math.round((voor / totaal) * 100) : 0,
      effectiviteit: totaalVoorAangenomen > 0
        ? Math.round((aangenomenVoor / totaalVoorAangenomen) * 100)
        : 0,
      besteMatch,
      slechsteMatch,
    }
  })
}

// Per-year voting breakdown
export function berekenJaarData(moties: Motie[]): JaarData[] {
  const jaarMap = new Map<string, Record<string, { voor: number; tegen: number; totaal: number }>>()

  for (const m of moties) {
    const jaar = m.datum.slice(0, 4)
    if (!jaarMap.has(jaar)) jaarMap.set(jaar, {})
    const jaarEntry = jaarMap.get(jaar)!
    for (const { partij, stem } of m.partijStemmen) {
      if (!jaarEntry[partij]) jaarEntry[partij] = { voor: 0, tegen: 0, totaal: 0 }
      jaarEntry[partij].totaal++
      if (stem === 'voor') jaarEntry[partij].voor++
      else jaarEntry[partij].tegen++
    }
  }

  return [...jaarMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jaar, partijen]) => ({ jaar, partijen }))
}

// Top coalition pairs (parties that vote together most)
export function berekenCoalitiepatronen(
  similariteit: SimilariteitsMatrix,
  minGedeeld = 20
): CoalitiePaar[] {
  const { partijen, matrix, aantalGedeeld } = similariteit
  const paren: CoalitiePaar[] = []

  for (let i = 0; i < partijen.length; i++) {
    for (let j = i + 1; j < partijen.length; j++) {
      if (aantalGedeeld[i][j] < minGedeeld) continue
      paren.push({
        partijA: partijen[i],
        partijB: partijen[j],
        pct: matrix[i][j],
        aantalGedeeld: aantalGedeeld[i][j],
      })
    }
  }

  return paren.sort((a, b) => b.pct - a.pct)
}
