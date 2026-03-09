import type { Motie, PartijStem } from '@/types'

// Canonical party names
const PARTIJ_NORMALISATIE: Record<string, string> = {
  'GroenLinks': 'GroenLinks',
  'GL': 'GroenLinks',
  'PvdA': 'PvdA',
  'D66': 'D66',
  'SP': 'SP',
  'VVD': 'VVD',
  'ChristenUnie': 'ChristenUnie',
  'CU': 'ChristenUnie',
  'Chr.Unie': 'ChristenUnie',
  'ChrUnie': 'ChristenUnie',
  'Christen Unie': 'ChristenUnie',
  'CDA': 'CDA',
  'Stadspartij': 'Stadspartij',
  'PVV': 'PVV',
  'Student & Stad': 'Student & Stad',
  'Student en Stad': 'Student & Stad',
  'Student& Stad': 'Student & Stad',
  'Student&Stad': 'Student & Stad',
  'S&S': 'Student & Stad',
  'Partij voor de Dieren': 'Partij voor de Dieren',
  'PvdD': 'Partij voor de Dieren',
  'Partij voor het Noorden': 'Partij voor het Noorden',
  'PvhN': 'Partij voor het Noorden',
}

const BEKENDE_PARTIJEN = new Set(Object.values(PARTIJ_NORMALISATIE))

function normaliseerPartij(naam: string): string {
  const getrimd = naam.replace(/^de\s+/i, '').trim()
  return PARTIJ_NORMALISATIE[getrimd] ?? getrimd
}

function isBekend(naam: string): boolean {
  return BEKENDE_PARTIJEN.has(naam)
}

// Smart split: first try direct lookup, then split by "en"
function splitPartijen(tekst: string): string[] {
  const partijen: string[] = []
  // Normalize whitespace but preserve content
  const norm = tekst.replace(/\s+/g, ' ').trim()
  // Split by comma first
  const commaDelen = norm.split(/,\s*/)
  for (const deel of commaDelen) {
    const getrimd = deel.trim()
    if (!getrimd) continue
    // Check if the whole part is a known party (including multi-word with "en")
    const directNorm = normaliseerPartij(getrimd)
    if (isBekend(directNorm)) {
      partijen.push(directNorm)
    } else {
      // Split by "en" and normalize each part
      const subDelen = getrimd.split(/\s+en\s+/i)
      for (const sub of subDelen) {
        const n = normaliseerPartij(sub.trim())
        if (isBekend(n)) partijen.push(n)
      }
    }
  }
  return [...new Set(partijen)] // deduplicate
}

// Check if "(voor: ...)" text contains party names (not vote counts)
function heeftPartijNamen(voorTekst: string): boolean {
  const eerste = voorTekst.split(/,/)[0].trim().toLowerCase()
  // If it starts with a number or "tegen:", it's a numerical count
  if (/^\d/.test(eerste)) return false
  if (eerste.startsWith('tegen')) return false
  return true
}

// Parse the "(voor: ...)" party list into PartijStem[]
function parseerVoorLijst(voorTekst: string, aanwezigePartijen: string[]): PartijStem[] {
  if (!heeftPartijNamen(voorTekst)) return []
  if (aanwezigePartijen.length === 0) return []

  const genorm = voorTekst.replace(/\s+/g, ' ').trim()
  const lower = genorm.toLowerCase()

  // "allen" or "met algemene stemmen" or "gehele raad" = unanimous for
  if (/^(?:allen|met algemene stemmen|alle fracties|gehele raad)/i.test(genorm)) {
    const minusMatch = genorm.match(/minus\s+(.+)/i)
    const uitgesloten = minusMatch ? splitPartijen(minusMatch[1]) : []
    return aanwezigePartijen.map((p) => ({
      partij: p,
      stem: uitgesloten.includes(p) ? 'tegen' : 'voor',
    }))
  }

  // Regular party list
  const voorPartijen = splitPartijen(genorm)
  // Only proceed if we actually got known parties
  if (voorPartijen.length === 0) return []

  return aanwezigePartijen.map((p) => ({
    partij: p,
    stem: voorPartijen.includes(p) ? 'voor' : 'tegen',
  }))
}

// Collect all parties that appear in "(voor:...)" blocks in this document section
function verzamelAanwezigePartijen(blok: string): string[] {
  const partijen = new Set<string>()
  const voorRegex = /\(voor:\s*([\s\S]+?)\)\s*\.?/gi
  let m: RegExpExecArray | null

  while ((m = voorRegex.exec(blok)) !== null) {
    const voorTekst = m[1].replace(/\s+/g, ' ').trim()
    if (!heeftPartijNamen(voorTekst)) continue

    const lower = voorTekst.toLowerCase()
    if (/^(?:allen|met algemene stemmen|alle fracties|gehele raad)/i.test(voorTekst)) {
      // Handle "allen, minus X, Y" - collect the minus parties
      const minusMatch = voorTekst.match(/minus\s+(.+)/i)
      if (minusMatch) {
        for (const p of splitPartijen(minusMatch[1])) {
          if (isBekend(p)) partijen.add(p)
        }
      }
      continue
    }

    for (const p of splitPartijen(voorTekst)) {
      if (isBekend(p)) partijen.add(p)
    }
  }

  return Array.from(partijen).sort()
}

// Extract the "(voor: ...)" text from a motie block
function extractVoorTekst(motieTekst: string): string {
  // Handle "(met algemene stemmen)" which has no "voor:" prefix
  if (/\(met algemene stemmen\)/i.test(motieTekst)) return 'met algemene stemmen'
  const match = motieTekst.match(/\(voor:\s*([\s\S]+?)\)\s*\.?\s*$/i)
  return match ? match[1].replace(/\s+/g, ' ').trim() : ''
}

// Extract the motie title and indieners
function extractMotieInfo(motieTekst: string): { titel: string; indieners: string[] } {
  // Remove "(voor: ...)" or "(met algemene stemmen)"
  const zonderVoor = motieTekst
    .replace(/\(voor:[\s\S]+?\)\s*\.?\s*$/, '')
    .replace(/\(met algemene stemmen\)\s*\.?\s*$/, '')
    .trim()

  // Remove leading "Motie N [van] "
  const body = zonderVoor.replace(/^Motie\s+\d+\s*\)?\.?\s*(?:van\s+)?/i, '').trim()

  // Split into comma parts; identify leading party sections vs title
  const delen = body.split(',').map((d) => d.trim()).filter(Boolean)
  const indienerDelen: string[] = []
  let titelStart = 0

  for (let i = 0; i < delen.length - 1; i++) {
    const deel = delen[i]
    // Check if this comma-part is entirely parties
    const parties = splitEnDelen(deel)
    if (parties.length > 0 && parties.every(isBekend)) {
      indienerDelen.push(deel)
      titelStart = i + 1
    } else {
      break
    }
  }

  const indieners = indienerDelen
    .flatMap((d) => splitEnDelen(d))
    .filter(isBekend)

  const rawTitel = delen.slice(titelStart).join(', ').trim() || body
  // Strip result suffix that sometimes appears in older besluitenlijsten
  const titel = rawTitel
    .replace(/,?\s*wordt\s+(verworpen|aangenomen).*$/i, '')
    .replace(/\s*\(met algemene stemmen\)\s*$/i, '')
    .trim()

  return { titel, indieners }
}

// Split one comma-part by "en", normalize, and return
function splitEnDelen(tekst: string): string[] {
  const directNorm = normaliseerPartij(tekst.trim())
  if (isBekend(directNorm)) return [directNorm]
  return tekst.split(/\s+en\s+/i)
    .map((p) => normaliseerPartij(p.trim()))
    .filter(isBekend)
}

// Find positions of "Motie N" starts within a block
function vindMotieBlokken(blok: string): string[] {
  const blokken: string[] = []
  const posities: number[] = []
  const motieRegex = /\nMotie\s+\d+/gi
  let m: RegExpExecArray | null
  while ((m = motieRegex.exec(blok)) !== null) {
    posities.push(m.index + 1)
  }
  for (let i = 0; i < posities.length; i++) {
    const start = posities[i]
    const end = i + 1 < posities.length ? posities[i + 1] : blok.length
    blokken.push(blok.slice(start, end).trim())
  }
  return blokken
}

export function parseBesluitenlijst(tekst: string, datum: string): Motie[] {
  const genormaliseerd = tekst.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const aangenomenIdx = genormaliseerd.search(/aangenomen\s+moties/i)
  const verworpenIdx = genormaliseerd.search(/verworpen\s+moties/i)
  const ingetrokkenIdx = genormaliseerd.search(/ingetrokken\s+moties/i)

  if (aangenomenIdx === -1 && verworpenIdx === -1) return []

  // Scope of moties section
  const motiesStart = Math.min(...[aangenomenIdx, verworpenIdx].filter((i) => i !== -1))
  const motiesEinde = ingetrokkenIdx > motiesStart
    ? ingetrokkenIdx
    : genormaliseerd.length
  const motiesBlok = genormaliseerd.slice(motiesStart, motiesEinde)

  // Build party list from actual "(voor:...)" data in this document
  const aanwezigePartijen = verzamelAanwezigePartijen(motiesBlok)
  if (aanwezigePartijen.length === 0) return []

  const secties: { aangenomen: boolean; start: number; end: number }[] = []
  if (aangenomenIdx !== -1) {
    const candidates = [verworpenIdx, ingetrokkenIdx].filter((i) => i > aangenomenIdx)
    secties.push({
      aangenomen: true,
      start: aangenomenIdx,
      end: candidates.length > 0 ? Math.min(...candidates) : genormaliseerd.length,
    })
  }
  if (verworpenIdx !== -1) {
    const candidates = [ingetrokkenIdx].filter((i) => i > verworpenIdx)
    secties.push({
      aangenomen: false,
      start: verworpenIdx,
      end: candidates.length > 0 ? Math.min(...candidates) : genormaliseerd.length,
    })
  }

  const moties: Motie[] = []
  let counter = 0

  for (const { aangenomen, start, end } of secties) {
    const blok = genormaliseerd.slice(start, end)
    const blokken = vindMotieBlokken(blok)

    for (const rawBlok of blokken) {
      // Normalize whitespace: collapse newlines/form-feeds to spaces
      const motieBlok = rawBlok.replace(/[\f]/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

      const voorTekst = extractVoorTekst(motieBlok)
      if (!voorTekst) continue

      const partijStemmen = parseerVoorLijst(voorTekst, aanwezigePartijen)
      if (partijStemmen.length === 0) continue

      const { titel, indieners } = extractMotieInfo(motieBlok)
      if (!titel || titel.length < 3) continue

      // Extract motie number from block start (e.g., "Motie 13 van ...")
      const numMatch = motieBlok.match(/^Motie\s+(\d+)/i)
      const motieNummer = numMatch ? parseInt(numMatch[1], 10) : null

      moties.push({
        id: `${datum}-${counter++}`,
        motieNummer,
        titel,
        indieners,
        datum,
        aangenomen,
        partijStemmen,
      })
    }
  }

  return moties
}
