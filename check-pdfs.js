const d = require('./data/moties.json')
const byDate = {}
d.moties.forEach(m => {
  const key = m.datum
  if (!byDate[key]) byDate[key] = {totaal:0, metPdf:0}
  byDate[key].totaal++
  if (m.pdfUrl) byDate[key].metPdf++
})
Object.entries(byDate).sort().reverse().forEach(([k,v]) => console.log(k, v.metPdf+'/'+v.totaal))
