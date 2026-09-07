import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  duration,
  isSchoolDay,
  listStamp,
  longDate,
  minutesBetween,
  nextSchoolDay,
  previousSchoolDay,
  relativeDay,
  relativeTime,
  shortDate,
  startOfWeek,
  weekday,
} from '../src/dates.js'

describe('semaine scolaire', () => {
  it('commence le lundi, y compris pour un dimanche', () => {
    // Le 2026-09-06 est un dimanche : il appartient à la semaine écoulée, pas à la suivante.
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31')
    expect(startOfWeek('2026-09-07')).toBe('2026-09-07')
    expect(startOfWeek('2026-09-12')).toBe('2026-09-07')
  })

  it('compte le samedi comme un jour d’école, pas le dimanche', () => {
    expect(isSchoolDay('2026-09-12')).toBe(true)
    expect(isSchoolDay('2026-09-13')).toBe(false)
  })

  it('saute le dimanche en avançant', () => {
    expect(nextSchoolDay('2026-09-12')).toBe('2026-09-14')
    expect(previousSchoolDay('2026-09-14')).toBe('2026-09-12')
  })

  it('ne dérive pas en traversant un changement d’heure', () => {
    // Fin octobre : en heure locale, un calcul naïf perd ou gagne une heure et saute un jour.
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27')
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3)
    expect(weekday('2026-10-25')).toBe(0)
  })
})

describe('dire une date', () => {
  it('dit ce qu’on dirait à voix haute', () => {
    expect(relativeDay('2026-09-07', '2026-09-07')).toBe("aujourd'hui")
    expect(relativeDay('2026-09-08', '2026-09-07')).toBe('demain')
    expect(relativeDay('2026-09-06', '2026-09-07')).toBe('hier')
    expect(relativeDay('2026-09-14', '2026-09-07')).toBe('lundi 14 septembre 2026')
  })

  it('abrège sans devenir illisible', () => {
    expect(shortDate('2026-02-03')).toBe('3 févr.')
    expect(longDate('2026-08-01')).toBe('samedi 1 août 2026')
  })

  it('donne l’heure pour aujourd’hui et la date sinon', () => {
    // « aujourd'hui » ne distingue pas 8 h d'il y a deux minutes.
    expect(listStamp('2026-09-07T14:02:00', '2026-09-07')).toBe('14:02')
    expect(listStamp('2026-09-06T14:02:00', '2026-09-07')).toBe('hier')
    expect(listStamp('2026-09-01T14:02:00', '2026-09-07')).toBe('1 sept.')
  })
})

describe('durées', () => {
  it('dit une durée comme on la dit', () => {
    expect(duration(45)).toBe('45 min')
    expect(duration(60)).toBe('1 h')
    expect(duration(90)).toBe('1 h 30')
    expect(duration(125)).toBe('2 h 05')
  })

  it('compte les minutes entre deux instants locaux', () => {
    expect(minutesBetween('2026-09-07T08:00:00', '2026-09-07T09:30:00')).toBe(90)
  })

  it('sait dire avant et après', () => {
    expect(relativeTime('2026-09-07T10:15:00', '2026-09-07T09:51:00')).toBe('dans 24 min')
    expect(relativeTime('2026-09-07T08:00:00', '2026-09-07T11:00:00')).toBe('il y a 3 h')
  })
})
