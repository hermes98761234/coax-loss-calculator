import { describe, expect, it } from 'vitest'
import { CABLES, attenuation100m, cableById, fitK } from './cables'

describe('fitK', () => {
  it('recovers exact coefficients', () => {
    const pts: [number, number][] = [10, 100, 500, 2000].map((f) => [f, 0.4 * Math.sqrt(f) + 0.002 * f])
    const { k1, k2 } = fitK(pts)
    expect(k1).toBeCloseTo(0.4, 6)
    expect(k2).toBeCloseTo(0.002, 6)
  })
  it('keeps coefficients non-negative', () => {
    const { k1, k2 } = fitK([[10, 3.16], [100, 10], [1000, 31.6]]) // pure sqrt law
    expect(k2).toBeGreaterThanOrEqual(0)
    expect(k1).toBeCloseTo(1, 2)
  })
})

describe('cable database', () => {
  it('has unique ids and sane parameters', () => {
    expect(new Set(CABLES.map((c) => c.id)).size).toBe(CABLES.length)
    for (const c of CABLES) {
      expect(c.k1, c.name).toBeGreaterThan(0)
      expect(c.k2, c.name).toBeGreaterThanOrEqual(0)
      expect(c.vf).toBeGreaterThan(0.5)
      expect(c.vf).toBeLessThan(1)
    }
  })
  it('reproduces every datasheet point within 12 %', () => {
    for (const c of CABLES)
      for (const [f, a] of c.points) expect(Math.abs(attenuation100m(c, f) / a - 1), `${c.name} @ ${f} MHz`).toBeLessThan(0.12)
  })
  it('matches well-known LMR-400 values (dB per 100 ft)', () => {
    const c = cableById('lmr400')!
    const per100ft = (f: number) => attenuation100m(c, f) * 0.3048
    expect(per100ft(900)).toBeCloseTo(3.9, 0)
    expect(per100ft(2400)).toBeGreaterThan(6.4)
    expect(per100ft(2400)).toBeLessThan(7.4)
  })
  it('ranks cables sensibly at 1 GHz', () => {
    const a = (id: string) => attenuation100m(cableById(id)!, 1000)
    expect(a('lmr600')).toBeLessThan(a('lmr400'))
    expect(a('lmr400')).toBeLessThan(a('rg213'))
    expect(a('rg213')).toBeLessThan(a('rg58'))
    expect(a('rg58')).toBeLessThan(a('rg174'))
    expect(a('ldf5')).toBeLessThan(a('ldf4'))
  })
})
