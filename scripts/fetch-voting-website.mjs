/**
 * Fetch per-party voting data from gemeenteraad.groningen.nl
 * for raadsvergadering meetings from 2017 onwards.
 * Outputs moties-website.json alongside the existing moties.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GRONINGEN_BASE = 'https://gemeenteraad.groningen.nl'
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'moties-website.json')

// Non-party roles to exclude from voting data
const EXCLUDE_ROLES = new Set([
  'Gemeenteraad', 'Burgemeester', 'Griffier', 'Plv. voorzitter gemeenteraad',
  'Voorzitter gemeenteraad', 'Voorzitter', 'Wethouder', 'Griffie', 'Presidium',
])

// Party name normalization from website names to canonical names
const PARTY_MAP = {
  'GroenLinks': 'GroenLinks',
  'PvdA': 'PvdA',
  'D66': 'D66',
  'SP': 'SP',
  'VVD': 'VVD',
  'ChristenUnie': 'ChristenUnie',
  'Partij voor de Dieren': 'Partij voor de Dieren',
  'CDA': 'CDA',
  'Stadspartij 100% voor Groningen': 'Stadspartij',
  'Student en Stad': 'Student & Stad',
  'Student & Stad': 'Student & Stad',
  'PVV': 'PVV',
  'Partij voor het Noorden': 'Partij voor het Noorden',
  '100% Groningen': '100% Groningen',
  'Stadspartij': 'Stadspartij',
  '100 procent Groningen': '100% Groningen',
  'Stad en Ommeland': 'Stad en Ommeland',
  'Groep Staijen': 'Groep Staijen',
  'Stadspartij voor Stad en Ommeland': 'Stad en Ommeland',
}

function normalizeParty(rawName) {
  // Strip "(N personen)" or "(1 persoon)" suffix (Dutch: persoon=singular, personen=plural)
  const name = rawName.replace(/\s*\(\d+ (?:persoon|personen)\).*/, '').trim()
  return PARTY_MAP[name] || name
}

// Parse per-party vote results from voteResultHtml
function parseVoteHtml(html) {
  const parties = []
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || []
  for (const row of rows) {
    const cells = row.match(/<td[\s\S]*?<\/td>/g) || []
    if (cells.length < 3) continue
    // For party cell, only get text from the first <span> to avoid person list
    const firstSpan = cells[0].match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''
    const rawParty = firstSpan.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!rawParty || rawParty.toLowerCase().includes('totaal')) continue
    const getText = c => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const voor = parseInt(getText(cells[1])) || 0
    const tegen = parseInt(getText(cells[2])) || 0
    const partij = normalizeParty(rawParty)
    if (EXCLUDE_ROLES.has(partij)) continue
    if (voor === 0 && tegen === 0) continue // skip zero-vote parties (afwezig)
    parties.push({ partij, stem: voor > 0 ? 'voor' : 'tegen' })
  }
  return parties
}

// Extract motie number and title from vote title like "M 02 Waterkwaliteit"
function parseMotieTitle(title) {
  const clean = title.trim()
  // Match "M XX title" or "Motie XX title" or "M XX. title"
  const match = clean.match(/^M(?:otie)?\s+(\d+)[\s\.\-:]*(.+)$/i)
  if (!match) return null
  return {
    motieNummer: parseInt(match[1], 10),
    titel: match[2].trim(),
  }
}

// Is this vote a motie? Check title pattern
function isMotie(title) {
  return /^M(?:otie)?\s+\d+/i.test(title.trim())
}

// Get meeting pages for a given year from calendar
async function getMeetingUrlsForYear(year) {
  const url = `${GRONINGEN_BASE}/Vergaderingen/gemeenteraad/${year}/`
  try {
    const resp = await fetch(url)
    if (!resp.ok) return []
    const html = await resp.text()
    // Extract meeting links: href="/Vergaderingen/gemeenteraad/YEAR/DD-MAAND/HH:MM"
    const regex = /href="(\/Vergaderingen\/gemeenteraad\/\d+\/[^"]+\/\d+:\d+)"/g
    const urls = new Set()
    let m
    while ((m = regex.exec(html)) !== null) {
      urls.add(m[1])
    }
    return Array.from(urls)
  } catch (e) {
    console.error(`Error fetching year ${year}:`, e.message)
    return []
  }
}

// Get internal meeting ID from meeting page HTML
async function getMeetingId(meetingPath) {
  try {
    const resp = await fetch(`${GRONINGEN_BASE}${meetingPath}`)
    if (!resp.ok) return null
    const html = await resp.text()
    // Look for: id="meeting-container" data-meeting-id="XXXX"
    const match = html.match(/id="meeting-container"\s[^>]*data-meeting-id="(\d+)"/)
    if (!match) return null
    return parseInt(match[1], 10)
  } catch (e) {
    return null
  }
}

// Extract date from meeting path: /Vergaderingen/gemeenteraad/2024/20-november/16:30
const MONTH_MAP = {
  'januari': '01', 'februari': '02', 'maart': '03', 'april': '04',
  'mei': '05', 'juni': '06', 'juli': '07', 'augustus': '08',
  'september': '09', 'oktober': '10', 'november': '11', 'december': '12',
}

function extractDate(meetingPath) {
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

// Fetch voting data for a meeting
async function fetchVotingData(meetingId) {
  try {
    const resp = await fetch(`${GRONINGEN_BASE}/vergaderingen/stemmingen/vergadering/${meetingId}/nested?noHTML=0`)
    if (!resp.ok) return null
    const d = await resp.json()
    return d.votes
  } catch (e) {
    return null
  }
}

// Process a single meeting: returns array of Motie objects
async function processMeeting(meetingPath, datum) {
  const meetingId = await getMeetingId(meetingPath)
  if (!meetingId) return []

  const votes = await fetchVotingData(meetingId)
  if (!votes || typeof votes !== 'object' || Array.isArray(votes)) return []

  const moties = []
  let counter = 0

  // Process all meetingItems and general votes
  const allVoteLists = []
  if (votes.meetingItems) {
    for (const mi of Object.values(votes.meetingItems)) {
      if (mi.votes) allVoteLists.push(...mi.votes)
    }
  }
  if (Array.isArray(votes.votes)) {
    allVoteLists.push(...votes.votes)
  }

  for (const vote of allVoteLists) {
    if (!isMotie(vote.title)) continue

    const parsed = parseMotieTitle(vote.title)
    if (!parsed) continue

    const partijStemmen = parseVoteHtml(vote.voteResultHtml)
    if (partijStemmen.length === 0) continue

    const aangenomen = vote.result === 'Aangenomen' ? true : vote.result === 'Verworpen' ? false : null

    moties.push({
      id: `${datum}-w-${counter++}`,
      motieNummer: parsed.motieNummer,
      titel: parsed.titel,
      indieners: [],  // Not available from voting data
      datum,
      aangenomen,
      partijStemmen,
    })
  }

  return moties
}

async function main() {
  const alleMoties = []
  const START_YEAR = 2017
  const END_YEAR = 2025

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    console.log(`\nYear ${year}:`)
    const meetingUrls = await getMeetingUrlsForYear(year)
    console.log(`  Found ${meetingUrls.length} meetings`)

    for (const url of meetingUrls) {
      const datum = extractDate(url)
      if (!datum) continue

      const moties = await processMeeting(url, datum)
      if (moties.length > 0) {
        alleMoties.push(...moties)
        console.log(`  ✓ ${datum}: ${moties.length} moties`)
      }
    }
  }

  alleMoties.sort((a, b) => b.datum.localeCompare(a.datum))

  const output = {
    gegenereerdOp: new Date().toISOString(),
    moties: alleMoties,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n✅ Klaar! ${alleMoties.length} moties geschreven naar moties-website.json`)
}

main().catch(console.error)
