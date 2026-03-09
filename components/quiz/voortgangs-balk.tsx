export function VoortgangsBalk({
  huidig,
  totaal,
  aantalGestemd,
}: {
  huidig: number
  totaal: number
  aantalGestemd: number
}) {
  const pct = Math.round((aantalGestemd / totaal) * 100)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Motie {huidig + 1} van {totaal}</span>
        <span>{aantalGestemd} gestemd</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
