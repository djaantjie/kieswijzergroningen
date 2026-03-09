const meetingId = 130359;
const resp = await fetch(`https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/${meetingId}/nested?noHTML=0`);
const d = await resp.json();
const v = d.votes;

console.log('groups count:', d.groups.length);
console.log('votes.votes:', Array.isArray(v.votes) ? v.votes.length : 'none');
console.log('votes.meetingItems:', v.meetingItems ? Object.keys(v.meetingItems).length : 'none');
console.log('votes.documents:', v.documents ? Object.keys(v.documents).length : 'none');

if (v.meetingItems) {
  let count = 0;
  for (const [k, mi] of Object.entries(v.meetingItems)) {
    for (const vote of (mi.votes || [])) {
      count++;
      if (count <= 2) {
        console.log('\n=== Vote', count, '===');
        console.log('title:', vote.title);
        console.log('result:', vote.result);
        console.log('votingId:', vote.votingId);
        // Show the HTML table content
        const html = vote.voteResultHtml;
        // Extract <tr> rows
        const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
        console.log('HTML rows count:', rows.length);
        rows.forEach(r => {
          const text = r.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) console.log('  Row:', text);
        });
      }
    }
  }
  console.log('\nTotal votes:', count);
}
