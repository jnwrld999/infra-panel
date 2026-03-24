const COLORS: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  error: 'bg-orange-500',
  unknown: 'bg-gray-500',
  active: 'bg-green-500',
  disabled: 'bg-yellow-500',
  pending: 'bg-blue-500',
  approved: 'bg-green-500',
  denied: 'bg-red-500',
  restricted: 'bg-gray-600',
}

export function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? 'bg-gray-500'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
      {status}
    </span>
  )
}
