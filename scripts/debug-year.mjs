// Debug why 2017/2018/2020/2021 have no moties

const GRONINGEN_BASE = 'https://gemeenteraad.groningen.nl'

async function getMeetingUrlsForYear(year) {
  const resp = await fetch(`${GRONINGEN_BASE}/Vergaderingen/gemeenteraad/${year}/`)
  const html = await resp.text()
  const regex = /href="(\/Vergaderingen\/gemeenteraad\/\d+\/[^"]+\/\d+:\d+)"/g
  const urls = new Set()
  let m
  while ((m = regex.exec(html)) !== null) urls.add(m[1])
  return Array.from(urls)
}

async function getMeetingId(path) {
  const resp = await fetch(`${GRONINGEN_BASE}${path}`)
  const html = await resp.text()
  const match = html.match(/id="meeting-container"\s[^>]*data-meeting-id="(\d+)"/)
  return match ? parseInt(match[1], 10) : null
}

// Test a specific year
const year = 2021
const urls = await getMeetingUrlsForYear(year)
console.log(`${year}: ${urls.length} meetings`)

// Check first 3 meetings
for (const url of urls.slice(0, 3)) {
  const meetingId = await getMeetingId(url)
  console.log(`\n${url} -> meetingId: ${meetingId}`)

  if (!meetingId) { console.log('  No meeting ID'); continue; }

  const resp = await fetch(`${GRONINGEN_BASE}/vergaderingen/stemmingen/vergadering/${meetingId}/nested?noHTML=0`)
  const d = await resp.json()
  const v = d.votes

  if (Array.isArray(v)) {
    console.log(`  votes is array, len: ${v.length}`)
  } else if (v) {
    const miCount = v.meetingItems ? Object.keys(v.meetingItems).length : 0
    const voteCount = Array.isArray(v.votes) ? v.votes.length : 0
    console.log(`  votes is object: meetingItems=${miCount}, votes=${voteCount}`)
    if (v.meetingItems) {
      for (const [k, mi] of Object.entries(v.meetingItems)) {
        for (const vote of (mi.votes || [])) {
          console.log(`    [${k}] "${vote.title}" -> ${vote.result}`)
        }
      }
    }
  } else {
    console.log('  no votes data')
  }
}
