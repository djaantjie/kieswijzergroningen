/**
 * Merge moties.json (ORI/besluitenlijst data, 2010-2016) with
 * moties-website.json (website voting data, 2019-2025)
 * into a single moties.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')

const oriData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'moties.json'), 'utf-8'))
const websiteData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'moties-website.json'), 'utf-8'))

// Convert website moties to full Motie format
let websiteCounter = 0
const websiteMoties = websiteData.moties.map(wm => ({
  id: `${wm.datum}-web-${websiteCounter++}`,
  motieNummer: wm.motieNummer,
  titel: wm.titel,
  indieners: [],
  datum: wm.datum,
  aangenomen: wm.aangenomen,
  partijStemmen: wm.partijStemmen,
}))

// Combine and sort
const alleMoties = [...oriData.moties, ...websiteMoties]
alleMoties.sort((a, b) => b.datum.localeCompare(a.datum))

const output = {
  gegenereerdOp: new Date().toISOString(),
  moties: alleMoties,
}

fs.writeFileSync(path.join(DATA_DIR, 'moties.json'), JSON.stringify(output, null, 2), 'utf-8')
console.log(`✅ Merged: ${oriData.moties.length} ORI + ${websiteMoties.length} website = ${alleMoties.length} total moties`)
console.log(`Years: ${[...new Set(alleMoties.map(m => m.datum.slice(0,4)))].sort().join(', ')}`)
