// Debug PVV cell parsing
const resp = await fetch('https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/4909/nested?noHTML=0');
const d = await resp.json();
const v = d.votes;

const allVotes = Object.values(v.meetingItems).flatMap(mi => mi.votes || []);
const motieVote = allVotes.find(v => v.title.match(/^M\s+\d+/i));

const html = motieVote.voteResultHtml;
const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];

for (const row of rows) {
  const cells = row.match(/<td[\s\S]*?<\/td>/g) || [];
  if (cells.length < 3) continue;

  // First span match
  const firstSpan = cells[0].match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? 'NO SPAN';
  const rawParty = firstSpan.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const getText = c => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const voor = parseInt(getText(cells[1])) || 0;
  const tegen = parseInt(getText(cells[2])) || 0;

  // Normalize
  const name = rawParty.replace(/\s*\(\d+ personen?\).*/, '').trim();

  console.log(`rawParty: "${rawParty}" -> name: "${name}" voor:${voor} tegen:${tegen}`);
}
