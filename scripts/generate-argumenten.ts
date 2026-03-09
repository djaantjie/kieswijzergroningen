/**
 * Generate pro/con arguments for recent moties using Claude API.
 * Run with: ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/generate-argumenten.ts
 */

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import type { Motie, MotiesTotalData } from '../types'

const GRONINGEN_BASE = 'https://gemeenteraad.groningen.nl'
const DATA_PATH = path.join(process.cwd(), 'data', 'moties.json')
const CUTOFF_DATE = '2025-11-01'

const MONTH_MAP: Record<string, string> = {
  '01': 'januari', '02': 'februari', '03': 'maart', '04': 'april',
  '05': 'mei', '06': 'juni', '07': 'juli', '08': 'augustus',
  '09': 'september', '10': 'oktober', '11': 'november', '12': 'december',
}

function datumNaarUrlPad(datum: string): string {
  const [year, month, day] = datum.split('-')
  return `${parseInt(day)}-${MONTH_MAP[month]}`
}

async function getMeetingAlleDocumentenUrl(datum: string): Promise<string | null> {
  const year = datum.slice(0, 4)
  const dagMaand = datumNaarUrlPad(datum)
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

async function findMotiePdfUrl(alleDocUrl: string, motieNummer: number): Promise<string | null> {
  try {
    const res = await fetch(alleDocUrl)
    if (!res.ok) return null
    const html = await res.text()
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

async function downloadPdfBase64(pdfUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.toString('base64')
  } catch {
    return null
  }
}

async function generateArgumenten(
  client: Anthropic,
  titel: string,
  pdfBase64: string
): Promise<{ voor: string; tegen: string } | null> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `Dit is de tekst van gemeenteraadsmotie "${titel}". Geef een kort argument VÓÓr én TÉGEN deze motie, elk maximaal 2 zinnen in het Nederlands. Schrijf begrijpelijk voor mensen zonder politieke achtergrond. Antwoord ALLEEN in dit exacte JSON-formaat zonder markdown of uitleg:\n{"voor":"...","tegen":"..."}`,
          },
        ],
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return null
    const text = content.text.trim()
    // Extract JSON from response (may have surrounding text)
    const match = text.match(/\{[\s\S]*"voor"[\s\S]*"tegen"[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as { voor: string; tegen: string }
  } catch (e) {
    console.error('Claude API error:', e)
    return null
  }
}

async function main() {
  const client = new Anthropic()

  const data: MotiesTotalData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
  const recenteMoties = data.moties.filter(
    (m) => m.datum >= CUTOFF_DATE && m.motieNummer !== null && !m.argumenten
  )

  console.log(`${recenteMoties.length} recente moties zonder argumenten gevonden`)

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

      const pdfUrl = motie.pdfUrl ?? await findMotiePdfUrl(alleDocUrl, motie.motieNummer)
      if (!pdfUrl) {
        console.log(`  M${motie.motieNummer} "${motie.titel.slice(0, 40)}" - geen PDF`)
        aantalGefaald++
        continue
      }

      const pdfBase64 = await downloadPdfBase64(pdfUrl)
      if (!pdfBase64) {
        console.log(`  M${motie.motieNummer} - PDF download mislukt`)
        aantalGefaald++
        continue
      }

      const argumenten = await generateArgumenten(client, motie.titel, pdfBase64)
      if (!argumenten) {
        console.log(`  M${motie.motieNummer} - argumenten genereren mislukt`)
        aantalGefaald++
        continue
      }

      motie.argumenten = argumenten
      aantalVerwerkt++
      console.log(`  ✓ M${motie.motieNummer} "${motie.titel.slice(0, 40)}"`)
      console.log(`    Voor: ${argumenten.voor.slice(0, 80)}...`)
      console.log(`    Tegen: ${argumenten.tegen.slice(0, 80)}...`)
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`\n✅ Klaar! ${aantalVerwerkt} argumenten toegevoegd, ${aantalGefaald} mislukt`)
}

main().catch(console.error)
