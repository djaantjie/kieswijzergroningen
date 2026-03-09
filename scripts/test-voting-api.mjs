// Test the Groningen voting API endpoint
const MEETINGS_TO_TEST = [
  { id: 812892, date: '2011-11-28' },
  { id: 862391, date: '2024-12-18' },
];

async function testMeeting(meetingId, date) {
  const url = `https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/${meetingId}/nested?noHTML=0`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.log(`${date} (${meetingId}): HTTP ${resp.status}`);
    return;
  }
  const d = await resp.json();
  const v = d.votes;
  if (!v || typeof v !== 'object' || Object.keys(v).length === 0) {
    console.log(`${date} (${meetingId}): no votes`);
    return;
  }
  const votesArr = v.votes || [];
  const meetingItems = v.meetingItems || {};
  const documents = v.documents || {};
  console.log(`${date} (${meetingId}): votes=${votesArr.length}, meetingItems=${Object.keys(meetingItems).length}, documents=${Object.keys(documents).length}`);
  if (votesArr.length > 0) {
    console.log('  First vote:', JSON.stringify(votesArr[0]).substring(0, 300));
  }
  const miKeys = Object.keys(meetingItems);
  if (miKeys.length > 0) {
    const first = meetingItems[miKeys[0]];
    console.log('  First meetingItem:', JSON.stringify(first).substring(0, 300));
  }
}

// Try different meeting IDs - brute force some known dates
// For 2024-11-20 raadsvergadering, try IDs from ORI
const ORI_IDS = [862391, 862497, 862496, 862170, 862165, 862231, 862166, 862164, 862172, 862111, 812892];
for (const id of ORI_IDS) {
  await testMeeting(id, '?');
}
