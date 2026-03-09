/**
 * Generate Dutch summaries for recent moties using Claude API.
 * Fetches PDFs from the Groningen gemeenteraad website and uses Claude to summarize.
 * Run with: npx tsx scripts/generate-summaries.ts
 */

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import type { Motie, MotiesTotalData } from '../types'

const GRONINGEN_BASE = 'https://gemeenteraad.groningen.nl'
const DATA_PATH = path.join(process.cwd(), 'data', 'moties.json')
const CUTOFF_DATE = '2025-11-01'  // Summaries for moties from this date onwards

const MONTH_MAP: Record<string, string> = {
  '01': 'januari', '02': 'februari', '03': 'maart', '04': 'april',
  '05': 'mei', '06': 'juni', '07': 'juli', '08': 'augustus',
  '09': 'september', '10': 'oktober', '11': 'november', '12': 'december',
}

// Convert ISO date "2025-12-17" to Groningen URL path "17-december"
function datumNaarUrlPad(datum: string): string {
  const [year, month, day] = datum.split('-')
  return `${parseInt(day)}-${MONTH_MAP[month]}`
}

// Get alle-documenten URL for a given datum
async function getMeetingAlleDocumentenUrl(datum: string): Promise<string | null> {
  const year = datum.slice(0, 4)
  const dagMaand = datumNaarUrlPad(datum)

  // Get calendar page to find exact meeting time
  const calUrl = `${GRONINGEN_BASE}/Vergaderingen/gemeenteraad/${year}/`
  try {
    const res = await fetch(calUrl)
    const html = await res.text()
    const regex = new RegExp(`href="(/Vergaderingen/gemeenteraad/${year}/${dagMaand}/[^"]+)"`, 'g')
    let m: RegExpExecArray | null
    while ((m = regex.exec(html)) !== null) {
      return `${GRONINGEN_BASE}${m[1]}/alle-documenten`
    }
  } catch {}
  return null
}

// Find PDF URL for a motie on the alle-documenten page
async function findMotiePdfUrl(
  alleDocUrl: string,
  motieNummer: number
): Promise<string | null> {
  try {
    const res = await fetch(alleDocUrl)
    if (!res.ok) return null
    const html = await res.text()
    // Match pattern: /Vergaderingen/.../M-NN-..../M-NN-....pdf
    // Also: /Documenten/Moties/Motie-N-...pdf (old format)
    const patterns = [
      new RegExp(`href="([^"]+/M-${String(motieNummer).padStart(2, '0')}-[^"]+\\.pdf)"`, 'i'),
      new RegExp(`href="([^"]+/M ${motieNummer}[^"]+\\.pdf)"`, 'i'),
      new RegExp(`href="([^"]+/Motie-${motieNummer}-[^"]+\\.pdf)"`, 'i'),
      new RegExp(`href="([^"]+/Motie_${motieNummer}[^"]+\\.pdf)"`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = pattern.exec(html)
      if (match) {
        const url = match[1].startsWith('http') ? match[1] : `${GRONINGEN_BASE}${match[1]}`
        return url
      }
    }
  } catch {}
  return null
}

// Download PDF as base64
async function downloadPdfBase64(pdfUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.toString('base64')
  } catch (e) {
    console.error('PDF download error:', e)
    return null
  }
}

// Generate Dutch summary using Claude with native PDF support
async function generateSummary(
  client: Anthropic,
  titel: string,
  pdfBase64: string
): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: `Dit is de tekst van gemeenteraadsmotie "${titel}". Geef een heldere samenvatting van 2-3 zinnen in het Nederlands. Beschrijf bondig: (1) wat het probleem of de aanleiding is, (2) wat de motie concreet vraagt. Schrijf actief en begrijpelijk voor mensen zonder politieke achtergrond. Begin direct met de inhoud, GEEN koptekst, GEEN markdown, GEEN bullet points.`,
          },
        ],
      }],
    })

    const content = response.content[0]
    if (content.type === 'text') return content.text.trim()
    return null
  } catch (e) {
    console.error('Claude API error:', e)
    return null
  }
}

async function main() {
  const client = new Anthropic()

  // Load moties
  const data: MotiesTotalData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
  const recenteMoties = data.moties.filter(
    (m) => m.datum >= CUTOFF_DATE && m.motieNummer !== null && !m.samenvatting
  )

  console.log(`${recenteMoties.length} recente moties zonder samenvatting gevonden`)

  // Group by datum to batch alle-documenten fetches
  const byDatum = new Map<string, Motie[]>()
  for (const m of recenteMoties) {
    if (!byDatum.has(m.datum)) byDatum.set(m.datum, [])
    byDatum.get(m.datum)!.push(m)
  }

  let aantalVerwerkt = 0
  let aantalGefaald = 0

  for (const [datum, moties] of byDatum) {
    console.log(`\nDatum: ${datum} (${moties.length} moties)`)
    const alleDocUrl = await getMeetingAlleDocumentenUrl(datum)
    if (!alleDocUrl) {
      console.log('  Geen documenten-URL gevonden')
      continue
    }

    for (const motie of moties) {
      if (!motie.motieNummer) continue

      // Find PDF
      const pdfUrl = await findMotiePdfUrl(alleDocUrl, motie.motieNummer)
      if (!pdfUrl) {
        console.log(`  M${motie.motieNummer} "${motie.titel.slice(0, 40)}" - geen PDF gevonden`)
        aantalGefaald++
        continue
      }

      // Download PDF as base64
      const pdfBase64 = await downloadPdfBase64(pdfUrl)
      if (!pdfBase64) {
        console.log(`  M${motie.motieNummer} - PDF download mislukt`)
        aantalGefaald++
        continue
      }

      // Generate summary via Claude
      const samenvatting = await generateSummary(client, motie.titel, pdfBase64)
      if (!samenvatting) {
        console.log(`  M${motie.motieNummer} - samenvatting genereren mislukt`)
        aantalGefaald++
        continue
      }

      // Update motie in data
      motie.samenvatting = samenvatting
      motie.pdfUrl = pdfUrl
      aantalVerwerkt++
      console.log(`  ✓ M${motie.motieNummer} "${motie.titel.slice(0, 40)}"`)
      console.log(`    ${samenvatting.slice(0, 100)}...`)
    }
  }

  // Save updated data
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`\n✅ Klaar! ${aantalVerwerkt} samenvattingen toegevoegd, ${aantalGefaald} mislukt`)
}

main().catch(console.error)
