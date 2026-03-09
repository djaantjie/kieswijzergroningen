// Debug the HTML parsing for votes

const resp = await fetch('https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/4909/nested?noHTML=0');
const d = await resp.json();
const v = d.votes;

// Get first motie vote
const miValues = Object.values(v.meetingItems);
const allVotes = miValues.flatMap(mi => mi.votes || []);
const motieVote = allVotes.find(v => v.title.match(/^M\s+\d+/i));

if (!motieVote) { console.log('No motie vote found'); process.exit(1); }

console.log('Title:', motieVote.title);
console.log('\nHTML:');
console.log(motieVote.voteResultHtml.substring(0, 3000));
