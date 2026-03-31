// import { RouterOutput } from '@pizza/trpc'
import { compareAsc, format, getDaysInMonth, parseISO } from 'date-fns'

const week = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

// biome-ignore lint/suspicious/noExplicitAny: test
export type WeekTime = any

type GenerateDaysWithTimesProps = {
  year: number
  month: number
  defaultWeekTimes: WeekTime[]
}

const dayToWeekday = (date: Date) => {
  return format(date, 'EEEE')
}

export function generateDaysWithTimes({
  year,
  month,
  defaultWeekTimes,
}: GenerateDaysWithTimesProps) {
  const daysOfMonth = getDaysInMonth(new Date(`${year}-${month}-01`))
  const days = Array.from({ length: daysOfMonth }, (_, i) => i + 1)

  const weekdays = days.map((day) => {
    return {
      weekDay: dayToWeekday(new Date(year, month - 1, day)).toUpperCase(),
      // biome-ignore lint/performance/useTopLevelRegex: test
      date: new Date(year, month - 1, day).toISOString().replace(/T.*$/, ''),
    }
  })

  const weekWithDays = week.map((day) => {
    return {
      day,
      dates: weekdays
        .filter((weekday) => weekday.weekDay === day)
        .map((weekday) => weekday.date),
    }
  })

  const filteredWeekDays = defaultWeekTimes
    .map((dwt) => {
      const weekDays = weekWithDays.filter((wwd) => wwd.day === dwt.dayOfWeek)

      return weekDays
        .map((wd) => {
          return wd.dates.map((date) => ({
            weekDay: wd.day,
            date,
            times: dwt.times,
          }))
        })
        .reduce((a, b) => a.concat(b), [])
    })
    .reduce((a, b) => a.concat(b), [])
    .map((d) => ({
      ...d,
      date: d.date,
    }))
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))

  const filteredWeekDaysWithOutDefaultTimes = weekdays.filter((weekday) => {
    return !filteredWeekDays.find((d) => d.date === weekday.date)
  })

  const allWeekDaysWithTimes = filteredWeekDays
    .concat(
      filteredWeekDaysWithOutDefaultTimes.map((d) => ({
        ...d,
        times: [],
      })),
    )
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))

  return allWeekDaysWithTimes
}
