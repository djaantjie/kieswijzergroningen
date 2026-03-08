import { Motie, PaarScore, CorrelatieResultaat } from "./types";

// Get the stem (vote direction) for a party on a motie
// Returns: 1 = voor, -1 = tegen, 0 = onthouden/absent
function getStem(motie: Motie, partij: string): number | null {
  const detail = motie.stemmingen.partij_detail[partij];
  if (!detail) return null;
  const totaal = detail.voor + detail.tegen + detail.onthouden;
  if (totaal === 0) return null;
  if (detail.voor > detail.tegen && detail.voor > detail.onthouden) return 1;
  if (detail.tegen > detail.voor && detail.tegen > detail.onthouden) return -1;
  return 0;
}

export function berekenCorrelatie(moties: Motie[]): CorrelatieResultaat {
  // Collect all parties (excluding placeholder)
  const partijSet = new Set<string>();
  for (const m of moties) {
    for (const p of Object.keys(m.stemmingen.partij_detail)) {
      if (p !== "Plv. voorzitter gemeenteraad") {
        partijSet.add(p);
      }
    }
  }
  const partijen = [...partijSet].sort();
  const n = partijen.length;

  // Build vote matrix: votes[partijIdx][motieIdx] = stem
  const votes: (number | null)[][] = partijen.map((p) =>
    moties.map((m) => getStem(m, p))
  );

  // Build NxN agreement matrix
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  );
  const counts: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  );

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let overeenkomst = 0;
      let count = 0;
      for (let k = 0; k < moties.length; k++) {
        const vi = votes[i][k];
        const vj = votes[j][k];
        if (vi === null || vj === null) continue;
        count++;
        if (vi === vj) overeenkomst++;
      }
      const score = count > 0 ? overeenkomst / count : 0;
      matrix[i][j] = score;
      matrix[j][i] = score;
      counts[i][j] = count;
      counts[j][i] = count;
    }
  }

  // Build top pairs
  const paren: PaarScore[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (counts[i][j] >= 5) {
        paren.push({
          partijA: partijen[i],
          partijB: partijen[j],
          score: matrix[i][j],
          aantalMoties: counts[i][j],
        });
      }
    }
  }

  paren.sort((a, b) => b.score - a.score);
  const topEens = paren.slice(0, 10);
  const topOneens = [...paren].sort((a, b) => a.score - b.score).slice(0, 10);

  return { matrix, partijen, topEens, topOneens };
}
