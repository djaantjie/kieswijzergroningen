import { ThumbsUp, ThumbsDown, FileText } from 'lucide-react'
import type { Motie } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function MotieDetail({ motie }: { motie: Motie }) {
  const voorStemmen = motie.partijStemmen.filter((s) => s.stem === 'voor')
  const tegenStemmen = motie.partijStemmen.filter((s) => s.stem === 'tegen')

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{motie.titel}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{new Date(motie.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          {motie.indieners.length > 0 && (
            <span>Ingediend door: {motie.indieners.join(', ')}</span>
          )}
        </div>
        {motie.samenvatting && (
          <p className="text-muted-foreground leading-relaxed">{motie.samenvatting}</p>
        )}
        <div className="flex items-center gap-3">
          {motie.pdfUrl && (
            <a
              href={motie.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="size-4" />
              Bekijk motie (PDF)
            </a>
          )}
          {motie.aangenomen === true && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Aangenomen
            </Badge>
          )}
          {motie.aangenomen === false && (
            <Badge className="bg-red-100 text-red-800 border-red-200">
              Verworpen
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {voorStemmen.length} voor · {tegenStemmen.length} tegen
          </span>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Partij</TableHead>
            <TableHead>Stem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {motie.partijStemmen
            .sort((a, b) => {
              if (a.stem === b.stem) return a.partij.localeCompare(b.partij)
              return a.stem === 'voor' ? -1 : 1
            })
            .map(({ partij, stem }) => (
              <TableRow key={partij}>
                <TableCell className="font-medium">{partij}</TableCell>
                <TableCell>
                  {stem === 'voor' ? (
                    <span className="flex items-center gap-1.5 text-green-700">
                      <ThumbsUp className="size-4" />
                      Voor
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-600">
                      <ThumbsDown className="size-4" />
                      Tegen
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}
