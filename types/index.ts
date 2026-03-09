export interface PartijStem {
  partij: string
  stem: 'voor' | 'tegen'
}

export interface Motie {
  id: string
  motieNummer: number | null
  titel: string
  indieners: string[]
  datum: string
  aangenomen: boolean | null
  partijStemmen: PartijStem[]
  pdfUrl?: string
  samenvatting?: string
  argumenten?: {
    voor: string
    tegen: string
  }
}

export type GebruikerStem = 'voor' | 'tegen' | 'overslaan'

export interface QuizState {
  stemmen: Record<string, GebruikerStem>
  huidigIndex: number
  afgerond: boolean
}

export interface MotieBreakdownItem {
  id: string
  titel: string
  eens: boolean
}

export interface PartijMatch {
  partij: string
  percentage: number
  overeenkomsten: number
  totaalVergelijkbaar: number
  motieBreakdown: MotieBreakdownItem[]
}

export interface MotiesTotalData {
  gegenereerdOp: string
  moties: Motie[]
}
