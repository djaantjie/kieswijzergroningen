// Scan ranges of meeting IDs for ones with real voting data (non-zero votes)
async function testId(id) {
  try {
    const resp = await fetch(`https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/${id}/nested?noHTML=0`);
    if (!resp.ok) return null;
    const d = await resp.json();
    const v = d.votes;
    if (!v || typeof v !== 'object') return null;
    const miCount = v.meetingItems ? Object.keys(v.meetingItems).length : 0;
    const voteCount = Array.isArray(v.votes) ? v.votes.length : 0;
    if (miCount === 0 && voteCount === 0) return null;

    // Check if any vote has actual party-level data (not just zeros)
    let hasRealData = false;
    let firstTitle = null;
    let firstResult = null;
    if (v.meetingItems) {
      for (const mi of Object.values(v.meetingItems)) {
        for (const vote of (mi.votes || [])) {
          if (!firstTitle) { firstTitle = vote.title; firstResult = vote.result; }
          // Check if HTML has more than just Totaal row
          if (vote.voteResultHtml && vote.voteResultHtml.includes('<tr>') &&
              (vote.voteResultHtml.match(/<tr>/g) || []).length > 2) {
            hasRealData = true;
          }
        }
      }
    }

    return { id, miCount, voteCount, hasRealData, firstTitle, firstResult };
  } catch (e) {
    return null;
  }
}

// Try larger ranges - the website might use much larger IDs
const RANGES = [
  [5000, 5100],
  [30000, 30100],
  [50000, 50100],
  [100000, 100050],
  [200000, 200050],
  [500000, 500050],
  [700000, 700050],
];

for (const [start, end] of RANGES) {
  const found = [];
  for (let id = start; id <= end; id++) {
    const r = await testId(id);
    if (r) found.push(r);
  }
  if (found.length > 0) {
    console.log(`Range ${start}-${end}: ${found.length} meetings with votes`);
    found.slice(0, 3).forEach(f => console.log(`  ID ${f.id}: ${f.miCount} items, realData=${f.hasRealData}, "${f.firstTitle}" -> ${f.firstResult}`));
  } else {
    console.log(`Range ${start}-${end}: none`);
  }
}
