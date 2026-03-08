import { Motie, SelectieModus, SelectieOpties } from "./types";

export const PARTIJ_KLEUREN: Record<string, string> = {
  "GroenLinks": "#4CAF50",
  "PvdA": "#E53935",
  "D66": "#00ACC1",
  "SP": "#E64A19",
  "VVD": "#1565C0",
  "ChristenUnie": "#5C6BC0",
  "Partij voor de Dieren": "#2E7D32",
  "CDA": "#388E3C",
  "Stadspartij 100% voor Groningen": "#F57C00",
  "Student en Stad": "#8E24AA",
  "PVV": "#1A237E",
  "Partij voor het Noorden": "#00695C",
  "Groep Staijen": "#546E7A",
  "Plv. voorzitter gemeenteraad": "#78909C",
};

export const PARTIJ_KORT: Record<string, string> = {
  "GroenLinks": "GL",
  "PvdA": "PvdA",
  "D66": "D66",
  "SP": "SP",
  "VVD": "VVD",
  "ChristenUnie": "CU",
  "Partij voor de Dieren": "PvdD",
  "CDA": "CDA",
  "Stadspartij 100% voor Groningen": "Stadspartij",
  "Student en Stad": "S&S",
  "PVV": "PVV",
  "Partij voor het Noorden": "PvhN",
  "Groep Staijen": "Staijen",
  "Plv. voorzitter gemeenteraad": "Plv.",
};

export const CAT_ICOON: Record<string, string> = {
  "Duurzaamheid & Energie": "⚡",
  "Wonen & Ruimte": "🏠",
  "Veiligheid & Handhaving": "🚔",
  "Onderwijs & Jeugd": "🎓",
  "Zorg & Welzijn": "❤️",
  "Verkeer & Mobiliteit": "🚲",
  "Economie & Werk": "💼",
  "Cultuur & Sport": "🎭",
  "Natuur & Openbare Ruimte": "🌳",
  "Bestuur & Financiën": "🏛️",
  "Internationaal & Diversiteit": "🌍",
  "Overig": "📌",
};

export async function laadMoties(): Promise<Motie[]> {
  const res = await fetch("/kieswijzergroningen/data/moties.json");
  if (!res.ok) throw new Error("Kon moties niet laden");
  return res.json();
}

export function berekenControversialiteit(motie: Motie): number {
  const { voor, tegen } = motie.stemmingen;
  const totaal = voor.length + tegen.length;
  if (totaal === 0) return 0;
  const ratio = voor.length / totaal;
  // Closest to 50% = most controversial (score near 1)
  return 1 - Math.abs(ratio - 0.5) * 2;
}

export function berekenControversialiteitPrecies(motie: Motie): number {
  // Use seat counts for more precision
  const pd = motie.stemmingen.partij_detail;
  let voorStemmen = 0;
  let tegenStemmen = 0;
  for (const p of Object.values(pd)) {
    voorStemmen += p.voor;
    tegenStemmen += p.tegen;
  }
  const totaal = voorStemmen + tegenStemmen;
  if (totaal === 0) return 0;
  const ratio = voorStemmen / totaal;
  return 1 - Math.abs(ratio - 0.5) * 2;
}

export function selecteerMoties(
  moties: Motie[],
  opties: SelectieOpties
): Motie[] {
  // Only use moties with known status and actual voting data
  const geldig = moties.filter(
    (m) =>
      m.status !== "ONBEKEND" &&
      (m.stemmingen.voor.length > 0 || m.stemmingen.tegen.length > 0) &&
      m.uitleg &&
      m.uitleg.length > 10
  );

  switch (opties.modus) {
    case "alle":
      return geldig;

    case "controversieel": {
      return [...geldig]
        .sort(
          (a, b) =>
            berekenControversialiteitPrecies(b) -
            berekenControversialiteitPrecies(a)
        )
        .slice(0, 30);
    }

    case "categorie": {
      const cats = opties.geselecteerdeCategorieen ?? [];
      if (cats.length === 0) return geldig;
      return geldig.filter((m) => cats.includes(m.categorie));
    }

    case "willekeurig": {
      const aantal = opties.aantalWillekeurig ?? 20;
      // Stratified by category
      const perCat: Record<string, Motie[]> = {};
      for (const m of geldig) {
        if (!perCat[m.categorie]) perCat[m.categorie] = [];
        perCat[m.categorie].push(m);
      }
      const cats = Object.keys(perCat);
      const result: Motie[] = [];
      const perCatAantal = Math.max(1, Math.floor(aantal / cats.length));

      for (const cat of cats) {
        const shuffled = [...perCat[cat]].sort(() => Math.random() - 0.5);
        result.push(...shuffled.slice(0, perCatAantal));
      }

      // Fill remaining
      const remaining = geldig.filter((m) => !result.includes(m));
      const shuffledRemaining = remaining.sort(() => Math.random() - 0.5);
      while (result.length < aantal && shuffledRemaining.length > 0) {
        result.push(shuffledRemaining.shift()!);
      }

      return result.sort(() => Math.random() - 0.5).slice(0, aantal);
    }

    default:
      return geldig;
  }
}

export function getCategorieen(moties: Motie[]): string[] {
  return [...new Set(moties.map((m) => m.categorie))].sort();
}

export function getStemPartijen(moties: Motie[]): string[] {
  const partijen = new Set<string>();
  for (const m of moties) {
    for (const p of Object.keys(m.stemmingen.partij_detail)) {
      if (p !== "Plv. voorzitter gemeenteraad") partijen.add(p);
    }
  }
  return [...partijen].sort();
}
