import fs from 'fs'
import path from 'path'
import type { MotiesTotalData } from '@/types'
import { QuizShell } from '@/components/quiz/quiz-shell'

function laadMoties(): MotiesTotalData {
  const p = path.join(process.cwd(), 'data', 'moties.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export default function QuizPage() {
  const { moties } = laadMoties()
  // Only include moties with party vote data
  const quizMoties = moties.filter((m) => m.partijStemmen.length >= 3 && m.pdfUrl)

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Stemwijzer Groningen</h1>
        <p className="text-muted-foreground">
          Stem voor of tegen echte gemeenteraadsmoties. Ontdek welke partij het beste bij jou past.
        </p>
      </div>
      <QuizShell moties={quizMoties} />
    </div>
  )
}
