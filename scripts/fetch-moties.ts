import fs from 'fs'
import path from 'path'
import { fetchBesluitenlijsten, fetchMotiePdfs, fetchMeetingUrls, scrapeMotiePdfs, fetchWebsiteMoties } from '../lib/ori-client'
import { parseBesluitenlijst } from '../lib/parse-besluitenlijst'
import type { Motie, MotiesTotalData } from '../types'

function extractDatum(dateString: string): string {
  return dateString.slice(0, 10)
}

async function main() {
  console.log('Besluitenlijsten ophalen van ORI API...')
  const docs = await fetchBesluitenlijsten()
  console.log(`${docs.length} besluitenlijsten gevonden`)

  const alleMoties: Motie[] = []
  let geparseerd = 0

  for (const doc of docs) {
    const datum = extractDatum(doc.date)
    try {
      const moties = parseBesluitenlijst(doc.text, datum)
      if (moties.length > 0) {
        alleMoties.push(...moties)
        geparseerd++
        console.log(`  ✓ ${doc.name}: ${moties.length} moties`)
      }
    } catch (err) {
      console.warn(`  ✗ ${doc.name}:`, err)
    }
  }

  console.log(`\nMotie PDFs ophalen van ORI API...`)
  const motiePdfs = await fetchMotiePdfs()
  console.log(`${motiePdfs.length} motie PDFs gevonden`)

  // Build lookup: "datum-motieNummer" -> pdfUrl
  const pdfLookup = new Map<string, string>()
  for (const pdf of motiePdfs) {
    pdfLookup.set(`${pdf.date}-${pdf.motieNummer}`, pdf.pdfUrl)
  }

  // Match PDFs to moties — pass 1: exact date + motieNummer
  let gekoppeld = 0
  for (const motie of alleMoties) {
    if (motie.motieNummer !== null) {
      const key = `${motie.datum}-${motie.motieNummer}`
      const url = pdfLookup.get(key)
      if (url) {
        motie.pdfUrl = url
        gekoppeld++
      }
    }
  }
  console.log(`${gekoppeld} moties gekoppeld via datum+nummer`)

  // Pass 2: title-based fallback for unmatched moties
  // PDF filenames contain the title, e.g. "Motie_12__van_...__Gered_gereedschap_gered__wordt_verworpen..."
  // Normalize title words and check if they all appear in the filename
  let extraGekoppeld = 0
  for (const motie of alleMoties) {
    if (motie.pdfUrl || motie.motieNummer === null) continue

    const titelWoorden = motie.titel
      .toLowerCase()
      .replace(/['''""]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)

    if (titelWoorden.length < 2) continue

    const kandidaat = motiePdfs.find((pdf) => {
      if (pdf.motieNummer !== motie.motieNummer) return false
      const bestandsnaam = pdf.name.replace(/_/g, ' ').toLowerCase()
      return titelWoorden.every((w) => bestandsnaam.includes(w))
    })

    if (kandidaat) {
      motie.pdfUrl = kandidaat.pdfUrl
      extraGekoppeld++
    }
  }
  if (extraGekoppeld > 0) {
    console.log(`${extraGekoppeld} extra moties gekoppeld via bestandsnaam-titel`)
  }
  gekoppeld += extraGekoppeld

  // Pass 3: scrape Groningen gemeenteraad website for remaining unmatched dates
  const ongematchteData = alleMoties.filter((m) => !m.pdfUrl && m.motieNummer !== null)
  const ongematcheDatums = new Set(ongematchteData.map((m) => m.datum))

  if (ongematcheDatums.size > 0) {
    console.log(`\nGroningen website scrapen voor ${ongematcheDatums.size} datums...`)
    const meetingUrls = await fetchMeetingUrls(ongematcheDatums)

    for (const [datum, url] of meetingUrls) {
      const pdfs = await scrapeMotiePdfs(url)
      const motiesOpDatum = alleMoties.filter((m) => m.datum === datum && !m.pdfUrl && m.motieNummer !== null)
      let n = 0
      for (const motie of motiesOpDatum) {
        const pdf = pdfs.find((p) => p.motieNummer === motie.motieNummer)
        if (pdf) {
          motie.pdfUrl = pdf.pdfUrl
          gekoppeld++
          n++
        }
      }
      console.log(`  ${datum}: ${n}/${motiesOpDatum.length} extra gekoppeld`)
    }
  }

  console.log(`Totaal: ${gekoppeld} moties gekoppeld aan een PDF`)

  // Phase 4: Fetch per-party voting data from gemeenteraad.groningen.nl (2019, 2022-2025)
  console.log(`\nGemeenteraad website scrapen voor moties 2019-2025...`)
  const websiteMoties = await fetchWebsiteMoties(2019, 2025)
  console.log(`${websiteMoties.length} moties gevonden op website`)

  // Convert website moties to Motie format and add them
  let websiteCounter = 0
  for (const wm of websiteMoties) {
    alleMoties.push({
      id: `${wm.datum}-web-${websiteCounter++}`,
      motieNummer: wm.motieNummer,
      titel: wm.titel,
      indieners: [],
      datum: wm.datum,
      aangenomen: wm.aangenomen,
      partijStemmen: wm.partijStemmen,
    })
  }

  // Deduplicate and sort newest first
  const uniek = Array.from(new Map(alleMoties.map((m) => [m.id, m])).values())
  uniek.sort((a, b) => b.datum.localeCompare(a.datum))

  const output: MotiesTotalData = {
    gegenereerdOp: new Date().toISOString(),
    moties: uniek,
  }

  const outputPath = path.join(process.cwd(), 'data', 'moties.json')
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`\n✅ Klaar! ${uniek.length} moties totaal (${alleMoties.length - websiteMoties.length} ORI + ${websiteMoties.length} website), ${gekoppeld} met PDF-link`)
}

main().catch(console.error)
