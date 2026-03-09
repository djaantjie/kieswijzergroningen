// Check for individual motie PDFs in ORI
const resp = await fetch('https://api.openraadsinformatie.nl/v1/elastic/ori_groningen/_search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: {
      bool: {
        must: [{ term: { '@type': 'MediaObject' } }],
        should: [
          { wildcard: { name: '*otie*' } },
          { wildcard: { file_name: '*otie*' } }
        ],
        minimum_should_match: 1
      }
    },
    _source: ['name', 'url', 'original_url', 'file_name', 'last_discussed_at'],
    size: 10
  })
});
const json = await resp.json();
console.log('Total hits:', json.hits.total.value);
for (const hit of json.hits.hits) {
  console.log(JSON.stringify(hit._source, null, 2));
}
