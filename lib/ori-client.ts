const ORI_BASE = 'https://api.openraadsinformatie.nl/v1/elastic/ori_groningen/_search'

interface OriHit {
  _id: string
  _source: {
    name: string
    text?: string[]
    md_text?: string[]
    last_discussed_at?: string
    '@type': string
  }
}

interface OriResponse {
  hits: {
    total: { value: number }
    hits: OriHit[]
  }
}

async function oriSearch(query: object): Promise<OriHit[]> {
  const res = await fetch(ORI_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  if (!res.ok) throw new Error(`ORI API error: ${res.status}`)
  const data: OriResponse = await res.json()
  return data.hits.hits
}

export interface BesluitenlijstDoc {
  id: string
  name: string
  text: string
  date: string
}

export interface MotiePdfDoc {
  motieNummer: number
  date: string          // "2012-05-30"
  pdfUrl: string        // direct link to the PDF
  name: string          // original filename for title-based fallback matching
}

export async function fetchBesluitenlijsten(): Promise<BesluitenlijstDoc[]> {
  const hits = await oriSearch({
    query: {
      bool: {
        must: [
          { term: { '@type': 'MediaObject' } },
          {
            bool: {
              should: [
                { wildcard: { name: '*Besluitenlijst*' } },
                { wildcard: { name: '*besluitenlijst*' } },
              ],
            },
          },
        ],
      },
    },
    _source: ['name', 'text', 'md_text', 'last_discussed_at'],
    size: 500,
  })

  return hits
    .map((hit) => ({
      id: hit._id,
      name: hit._source.name,
      text: (hit._source.text ?? hit._source.md_text ?? []).join('\n'),
      date: hit._source.last_discussed_at ?? '',
    }))
    .filter((doc) => doc.text.length > 0)
}

const GRONINGEN_BASE = 'https://gemeenteraad.groningen.nl'

// Fetch meeting URLs from Groningen API for a set of dates
export async function fetchMeetingUrls(targetDates: Set<string>): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const remaining = new Set(targetDates)

  // Scan a range of offsets around where 2010–2016 meetings tend to be
  for (let offset = 1550; offset <= 1900; offset += 100) {
    if (remaining.size === 0) break
    const res = await fetch(`${GRONINGEN_BASE}/api/v2/meetings?offset=${offset}&limit=100`)
    const data: any = await res.json()
    const meetings: any[] = data.result?.meetings ?? []

    for (const m of meetings) {
      if (remaining.has(m.date) && m.dmu?.id === 1) {
        result.set(m.date, `${GRONINGEN_BASE}${m.url}/alle-documenten`)
        remaining.delete(m.date)
      }
    }
  }

  return result
}

// ============================================================
// Groningen website voting data (2019, 2022-2025)
// ============================================================

export interface WebsiteMotie {
  datum: string
  motieNummer: number
  titel: string
  aangenomen: boolean | null
  partijStemmen: { partij: string; stem: 'voor' | 'tegen' }[]
}

const MONTH_MAP: Record<string, string> = {
  januari: '01', februari: '02', maart: '03', april: '04',
  mei: '05', juni: '06', juli: '07', augustus: '08',
  september: '09', oktober: '10', november: '11', december: '12',
}

const WEBSITE_PARTY_MAP: Record<string, string> = {
  GroenLinks: 'GroenLinks', PvdA: 'PvdA', D66: 'D66', SP: 'SP', VVD: 'VVD',
  ChristenUnie: 'ChristenUnie', 'Partij voor de Dieren': 'Partij voor de Dieren',
  CDA: 'CDA', 'Stadspartij 100% voor Groningen': 'Stadspartij',
  'Student en Stad': 'Student & Stad', 'Student & Stad': 'Student & Stad',
  PVV: 'PVV', 'Partij voor het Noorden': 'Partij voor het Noorden',
  '100% Groningen': '100% Groningen', Stadspartij: 'Stadspartij',
  '100 procent Groningen': '100% Groningen', 'Stad en Ommeland': 'Stad en Ommeland',
  'Groep Staijen': 'Groep Staijen', 'Stadspartij voor Stad en Ommeland': 'Stad en Ommeland',
}

const EXCLUDE_WEBSITE_ROLES = new Set([
  'Gemeenteraad', 'Burgemeester', 'Griffier', 'Plv. voorzitter gemeenteraad',
  'Voorzitter gemeenteraad', 'Voorzitter', 'Wethouder', 'Griffie', 'Presidium',
])

function normalizeWebsiteParty(rawName: string): string {
  const name = rawName.replace(/\s*\(\d+ (?:persoon|personen)\).*/, '').trim()
  return WEBSITE_PARTY_MAP[name] || name
}

function parseVoteHtml(html: string): { partij: string; stem: 'voor' | 'tegen' }[] {
  const parties: { partij: string; stem: 'voor' | 'tegen' }[] = []
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) ?? []
  for (const row of rows) {
    const cells: string[] = row.match(/<td[\s\S]*?<\/td>/g) ?? []
    if (cells.length < 3) continue
    const cell0 = cells[0] as string
    const spanMatch = cell0.match(/<span[^>]*>([\s\S]*?)<\/span>/)
    const firstSpan = spanMatch ? spanMatch[1] ?? '' : ''
    const rawParty = firstSpan.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!rawParty || rawParty.toLowerCase().includes('totaal')) continue
    const getText = (c: string) => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const voor = parseInt(getText(cells[1] as string)) || 0
    const tegen = parseInt(getText(cells[2] as string)) || 0
    const partij = normalizeWebsiteParty(rawParty)
    if (EXCLUDE_WEBSITE_ROLES.has(partij)) continue
    if (voor === 0 && tegen === 0) continue
    parties.push({ partij, stem: voor > 0 ? 'voor' : 'tegen' })
  }
  return parties
}

function parseMotieTitle(title: string): { motieNummer: number; titel: string } | null {
  const match = title.trim().match(/^M(?:otie)?\s+(\d+)[\s.\-:]*(.+)$/i)
  if (!match) return null
  return { motieNummer: parseInt(match[1], 10), titel: match[2].trim() }
}

function extractDateFromPath(meetingPath: string): string | null {
  const parts = meetingPath.split('/')
  const year = parts[3]
  const dayMonth = parts[4]
  if (!dayMonth) return null
  const dmMatch = dayMonth.match(/^(\d+)-(.+)$/)
  if (!dmMatch) return null
  const day = dmMatch[1].padStart(2, '0')
  const month = MONTH_MAP[dmMatch[2].toLowerCase()]
  if (!month) return null
  return `${year}-${month}-${day}`
}

async function getMeetingUrlsForYear(year: number): Promise<string[]> {
  try {
    const res = await fetch(`${GRONINGEN_BASE}/Vergaderingen/gemeenteraad/${year}/`)
    if (!res.ok) return []
    const html = await res.text()
    const regex = /href="(\/Vergaderingen\/gemeenteraad\/\d+\/[^"]+\/\d+:\d+)"/g
    const urls = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = regex.exec(html)) !== null) urls.add(m[1])
    return Array.from(urls)
  } catch { return [] }
}

async function getMeetingInternalId(meetingPath: string): Promise<number | null> {
  try {
    const res = await fetch(`${GRONINGEN_BASE}${meetingPath}`)
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/id="meeting-container"\s[^>]*data-meeting-id="(\d+)"/)
    return match ? parseInt(match[1], 10) : null
  } catch { return null }
}

async function fetchMeetingVotesById(meetingId: number): Promise<any> {
  try {
    const res = await fetch(`${GRONINGEN_BASE}/vergaderingen/stemmingen/vergadering/${meetingId}/nested?noHTML=0`)
    if (!res.ok) return null
    const d = await res.json()
    return d.votes
  } catch { return null }
}

export async function fetchWebsiteMoties(startYear = 2019, endYear = 2025): Promise<WebsiteMotie[]> {
  const alleMoties: WebsiteMotie[] = []

  for (let year = startYear; year <= endYear; year++) {
    const meetingUrls = await getMeetingUrlsForYear(year)
    for (const url of meetingUrls) {
      const datum = extractDateFromPath(url)
      if (!datum) continue
      const meetingId = await getMeetingInternalId(url)
      if (!meetingId) continue
      const votes = await fetchMeetingVotesById(meetingId)
      if (!votes || typeof votes !== 'object' || Array.isArray(votes)) continue

      const allVotes: any[] = []
      if (votes.meetingItems) {
        for (const mi of Object.values(votes.meetingItems) as any[]) {
          if (mi.votes) allVotes.push(...mi.votes)
        }
      }
      if (Array.isArray(votes.votes)) allVotes.push(...votes.votes)

      let counter = 0
      for (const vote of allVotes) {
        if (!/^M(?:otie)?\s+\d+/i.test(vote.title?.trim() ?? '')) continue
        const parsed = parseMotieTitle(vote.title)
        if (!parsed) continue
        const partijStemmen = parseVoteHtml(vote.voteResultHtml ?? '')
        if (partijStemmen.length === 0) continue
        const aangenomen = vote.result === 'Aangenomen' ? true : vote.result === 'Verworpen' ? false : null
        alleMoties.push({ datum, motieNummer: parsed.motieNummer, titel: parsed.titel, aangenomen, partijStemmen })
        counter++
      }
      if (counter > 0) console.log(`  ✓ ${datum}: ${counter} moties`)
    }
  }

  return alleMoties
}

// Scrape motie PDF links from a meeting's alle-documenten page
export async function scrapeMotiePdfs(
  alleDocumentenUrl: string
): Promise<Array<{ motieNummer: number; pdfUrl: string }>> {
  const res = await fetch(alleDocumentenUrl)
  if (!res.ok) return []
  const html = await res.text()

  const regex = /href="(\/Documenten\/Moties\/[^"]+\.pdf)"/g
  const results: Array<{ motieNummer: number; pdfUrl: string }> = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    const path = match[1]
    const numMatch = path.match(/Motie-(\d+)-/)
    if (numMatch) {
      results.push({
        motieNummer: parseInt(numMatch[1], 10),
        pdfUrl: `${GRONINGEN_BASE}${path}`,
      })
    }
  }

  return results
}

// Fetch all individual motie PDF documents from ORI
export async function fetchMotiePdfs(): Promise<MotiePdfDoc[]> {
  // Fetch in batches (ORI limits to 500 per request, total ~2200)
  const allHits: OriHit[] = []
  const batchSize = 500

  for (let offset = 0; offset < 3000; offset += batchSize) {
    const hits = await oriSearch({
      query: {
        bool: {
          must: [{ term: { '@type': 'MediaObject' } }],
          should: [
            { wildcard: { name: 'Motie_*' } },
            { wildcard: { name: 'Motie *' } },
            { regexp: { name: '[Mm]otie[ _]\\d+.*\\.pdf' } },
          ],
          minimum_should_match: 1,
        },
      },
      _source: ['name', 'original_url', 'last_discussed_at'],
      size: batchSize,
      from: offset,
    })
    allHits.push(...hits)
    if (hits.length < batchSize) break
  }

  const results: MotiePdfDoc[] = []
  for (const hit of allHits) {
    const src = hit._source as { name: string; original_url?: string; last_discussed_at?: string }
    if (!src.original_url || !src.last_discussed_at) continue

    // Extract motie number from filename: "Motie_3)_van_..." or "Motie_13__van_..."
    const numMatch = src.name.match(/[Mm]otie[_ ](\d+)/i)
    if (!numMatch) continue

    const motieNummer = parseInt(numMatch[1], 10)
    const date = src.last_discussed_at.slice(0, 10)

    results.push({ motieNummer, date, pdfUrl: src.original_url, name: src.name })
  }

  return results
}
