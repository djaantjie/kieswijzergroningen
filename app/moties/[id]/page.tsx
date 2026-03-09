import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { MotiesTotalData } from '@/types'
import { MotieDetail } from '@/components/moties/motie-detail'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

function laadMoties(): MotiesTotalData {
  const p = path.join(process.cwd(), 'data', 'moties.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export default async function MotieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { moties } = laadMoties()
  const motie = moties.find((m) => m.id === decodeURIComponent(id))

  if (!motie) notFound()

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild size="sm">
        <Link href="/moties">
          <ArrowLeft className="size-4" />
          Terug naar overzicht
        </Link>
      </Button>
      <MotieDetail motie={motie} />
    </div>
  )
}

export async function generateStaticParams() {
  const { moties } = laadMoties()
  return moties.map((m) => ({ id: encodeURIComponent(m.id) }))
}
