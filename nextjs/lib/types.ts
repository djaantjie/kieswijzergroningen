export interface Motie {
  jaar: number;
  maand: number;
  motie_nr: string;
  titel: string;
  volledige_titel: string;
  status: "AANGENOMEN" | "VERWORPEN" | "INGETROKKEN" | "ONBEKEND";
  indieners: string[];
  pdf_url: string;
  doc_id: string;
  stemmingen: {
    voor: string[];
    tegen: string[];
    onthouden: string[];
    uitslag: string;
    partij_detail: Record<string, { voor: number; tegen: number; onthouden: number }>;
  };
  samenvatting: string;
  titel_leesbaar: string;
  uitleg: string;
  categorie: string;
  voordelen: string[];
  nadelen: string[];
  context: string;
  bronnen: Array<{ naam: string; url: string; beschrijving: string }>;
}

export type Stem = "eens" | "neutraal" | "oneens" | "overgeslagen";

export interface Antwoord {
  motieNr: string;
  stem: Stem;
}

export interface PartijScore {
  partij: string;
  score: number;
  overeenkomst: number;
  totaalVergelijkbaar: number;
}

export interface PaarScore {
  partijA: string;
  partijB: string;
  score: number;
  aantalMoties: number;
}

export interface CorrelatieResultaat {
  matrix: number[][];
  partijen: string[];
  topEens: PaarScore[];
  topOneens: PaarScore[];
}

export type SelectieModus = "alle" | "controversieel" | "categorie" | "willekeurig";

export interface SelectieOpties {
  modus: SelectieModus;
  aantalWillekeurig?: number;
  geselecteerdeCategorieen?: string[];
}

export type AppView = "welkom" | "selectie" | "quiz" | "resultaten";
