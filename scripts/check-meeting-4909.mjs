const resp = await fetch('https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/4909/nested?noHTML=0');
const d = await resp.json();
const v = d.votes;

let count = 0;
for (const [itemKey, mi] of Object.entries(v.meetingItems)) {
  for (const vote of (mi.votes || [])) {
    count++;
    if (count <= 3) {
      console.log('\n=== Vote', count, '===');
      console.log('itemKey:', itemKey);
      console.log('title:', vote.title);
      console.log('result:', vote.result);
      console.log('votingId:', vote.votingId);

      // Parse the HTML to extract party votes
      const html = vote.voteResultHtml;
      const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
      console.log('table rows:', rows.length);
      rows.forEach(r => {
        const text = r.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text && text !== 'Partij Voor Tegen') console.log('  ', text);
      });
    }
  }
}
console.log('\nTotal votes:', count);
