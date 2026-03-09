const resp = await fetch('https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/5023/nested?noHTML=0');
const d = await resp.json();
const v = d.votes;

for (const [k, mi] of Object.entries(v.meetingItems)) {
  for (const vote of mi.votes) {
    console.log('=== Vote ===');
    console.log('title:', vote.title);
    console.log('result:', vote.result);
    console.log('votingId:', vote.votingId);
    console.log('HTML:', vote.voteResultHtml.substring(0, 2000));
    console.log();
  }
}
