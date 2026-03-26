interface EmbedField { name: string; value: string; inline?: boolean }
interface EmbedData {
  title?: string
  description?: string
  color?: string   // hex like '#5865F2'
  fields?: EmbedField[]
  footer?: string
  image?: string
  thumbnail?: string
}

export function EmbedPreview({ embed }: { embed: EmbedData }) {
  const borderColor = embed.color || '#5865F2'
  return (
    <div className="rounded-md overflow-hidden max-w-md" style={{ borderLeft: `4px solid ${borderColor}`, background: 'hsl(var(--card))' }}>
      <div className="p-3 space-y-2">
        {embed.thumbnail && (
          <img src={embed.thumbnail} alt="" className="float-right w-16 h-16 rounded object-cover ml-2" />
        )}
        {embed.title && <p className="text-sm font-semibold text-foreground">{embed.title}</p>}
        {embed.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{embed.description}</p>}
        {embed.fields && embed.fields.length > 0 && (
          <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {embed.fields.map((f, i) => (
              <div key={i} className={f.inline ? '' : 'col-span-full'}>
                <p className="text-[11px] font-semibold text-foreground">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{f.value}</p>
              </div>
            ))}
          </div>
        )}
        {embed.image && <img src={embed.image} alt="" className="rounded w-full max-h-48 object-cover" />}
        {embed.footer && (
          <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-2 mt-2">{embed.footer}</p>
        )}
      </div>
    </div>
  )
}
