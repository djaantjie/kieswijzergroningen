// Find Groningen meeting IDs with voting data
// Try a range of IDs to find which ones have vote data

async function testId(id) {
  try {
    const resp = await fetch(`https://gemeenteraad.groningen.nl/vergaderingen/stemmingen/vergadering/${id}/nested?noHTML=0`);
    if (!resp.ok) return null;
    const d = await resp.json();
    const v = d.votes;
    if (!v || typeof v !== 'object') return null;
    const miCount = v.meetingItems ? Object.keys(v.meetingItems).length : 0;
    const voteCount = Array.isArray(v.votes) ? v.votes.length : 0;
    if (miCount > 0 || voteCount > 0) {
      return { id, miCount, voteCount };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// First check specific IDs based on the data-voting-ref values mentioned
// data-voting-ref was "63548", "63549" - try around those
// Also try range around ORI meeting IDs (7704070 range) and smaller ranges

const ranges = [
  // Around the voting-ref IDs mentioned
  [63500, 63600],
  // Smaller sequential ranges
  [1000, 1050],
  [5000, 5050],
  [10000, 10050],
  [20000, 20050],
];

console.log('Testing ranges...');
for (const [start, end] of ranges) {
  console.log(`\nTesting ${start}-${end}:`);
  for (let id = start; id <= end; id++) {
    const result = await testId(id);
    if (result) {
      console.log(`  FOUND: ID ${id} has ${result.miCount} meetingItems, ${result.voteCount} votes`);
    }
  }
}
