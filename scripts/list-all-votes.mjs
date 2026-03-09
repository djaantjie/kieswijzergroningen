// Show all votes for meeting 4909 to understand which ones are moties

async function parseVoteHtml(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const result = [];
  for (const row of rows) {
    const cells = row.match(/<td[\s\S]*?<\/td>/g) || [];
    if (cells.length >= 3) {
      const getText = c => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const party = getText(cells[0]);
      const voor = parseInt(getText(cells[1])) || 0;
      const tegen = parseInt(getText(cells[2])) || 0;
      if (party && !party.includes('Totaal')) result.push({ party, voor, tegen });
    }
  }
  return result;
}

const resp = await fetch('https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/4909/nested?noHTML=0');
const d = await resp.json();
const v = d.votes;

for (const [itemKey, mi] of Object.entries(v.meetingItems)) {
  for (const vote of (mi.votes || [])) {
    console.log(`"${vote.title}" -> ${vote.result} (id:${vote.votingId})`);
  }
}
