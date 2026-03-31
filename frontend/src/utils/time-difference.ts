import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from 'date-fns'

export function formatTimeDifference(dateString: string) {
  const providedDate = new Date(dateString)
  const now = new Date()

  const minutes = differenceInMinutes(now, providedDate)
  if (minutes < 60) {
    return `${minutes} minuto${minutes === 1 ? '' : 's'}`
  }

  const hours = differenceInHours(now, providedDate)
  if (hours < 24) {
    return `${hours} hora${hours === 1 ? '' : 's'}`
  }

  const days = differenceInDays(now, providedDate)
  if (days < 7) {
    return `${days} dia${days === 1 ? '' : 's'}`
  }

  // Fallback for dates older than 7 days, or if the date is in the future
  // For simplicity, I'll return days for now, but you might want to adjust this.
  return `${days} dia${days === 1 ? '' : 's'}`
}
