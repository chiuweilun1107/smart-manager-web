/** 時區感知的日期時間格式化，用 user.timezone (預設 Asia/Taipei) */
export function formatInTimezone(
  date: Date | string,
  timezone = 'Asia/Taipei',
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    ...opts,
  }).format(d)
}

export function formatDateInTimezone(date: Date | string, timezone = 'Asia/Taipei'): string {
  return formatInTimezone(date, timezone, { hour: undefined, minute: undefined })
}
