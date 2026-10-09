import { describe, expect, it } from 'vitest'
import { cableById } from './cables'
import { compute, electrical, gammaToVswr, lenToM, mismatch, powerRating, powerToW, summary, vswrToGamma, wToPower } from './coax'
import { DEFAULTS } from './presets'

describe('mismatch', () => {
  it('adds no loss to a lossless line only through reflection of nothing', () => {
    expect(mismatch(0, 3).extraLossDb).toBeCloseTo(0, 9)
  })
  it('matches the ARRL value: 1 dB line, 3:1 load, about 0.5 dB extra', () => {
    const m = mismatch(1, 3)
    expect(m.extraLossDb).toBeCloseTo(0.504, 2)
  })
  it('matched load adds nothing', () => {
    expect(mismatch(3, 1).extraLossDb).toBeCloseTo(0, 12)
  })
  it('input VSWR approaches 1 as the line gets lossy', () => {
    expect(mismatch(0, 3).vswrIn).toBeCloseTo(3, 9)
    const m = mismatch(10, 3)
    expect(m.vswrIn).toBeCloseTo(gammaToVswr(0.5 * 0.1), 9)
    expect(m.vswrIn).toBeLessThan(1.25)
  })
  it('converts VSWR and reflection coefficient', () => {
    expect(vswrToGamma(3)).toBeCloseTo(0.5)
    expect(gammaToVswr(0.5)).toBeCloseTo(3)
    expect(vswrToGamma(1)).toBe(0)
  })
  it('hot spot is 1 + Γ² on a lossless line', () => {
    expect(mismatch(0, 3).hotSpot).toBeCloseTo(1.25, 9)
    expect(mismatch(0, 1).hotSpot).toBeCloseTo(1, 9)
  })
})

describe('electrical length', () => {
  it('quarter wave of RG-58 at 144 MHz (VF 0.66)', () => {
    const e = electrical(cableById('rg58')!, 144, 1)
    expect(e.lambda0).toBeCloseTo(2.0820, 3)
    expect(e.quarterWaveM).toBeCloseTo((2.0820 * 0.66) / 4, 3)
    expect(electrical(cableById('rg58')!, 144, e.quarterWaveM).degrees).toBeCloseTo(90, 6)
  })
  it('delay and capacitance of a 50 ohm VF 0.66 cable', () => {
    const e = electrical(cableById('rg213')!, 100, 10)
    expect(e.delayNs).toBeCloseTo(50.5, 1) // 5.05 ns/m
    expect(e.capPfPerM).toBeCloseTo(101, 0) // RG-213: ~101 pF/m
  })
})

describe('power rating', () => {
  const lmr = cableById('lmr400')!
  const matched = mismatch(0.1, 1)
  it('equals the datasheet value at 100 MHz, 40 °C, matched', () => {
    const r = powerRating(lmr, 100, 40, matched)
    expect(r.watts).toBeCloseTo(lmr.p100, 6)
    expect(r.limit).toBe('thermal')
  })
  it('falls with frequency like the attenuation', () => {
    const r1 = powerRating(lmr, 100, 40, matched).watts
    const r2 = powerRating(lmr, 1000, 40, matched).watts
    expect(r2).toBeLessThan(r1 / 2.5)
    expect(r2).toBeGreaterThan(r1 / 4.5)
  })
  it('falls with ambient temperature and VSWR', () => {
    const cool = powerRating(lmr, 450, 20, matched).watts
    const hot = powerRating(lmr, 450, 60, matched).watts
    expect(hot).toBeLessThan(cool)
    expect(powerRating(lmr, 450, 60, mismatch(0.1, 1)).tempFactor).toBeCloseTo((85 - 60) / 45, 9)
    expect(powerRating(lmr, 450, 40, mismatch(0.1, 3)).watts).toBeLessThan(powerRating(lmr, 450, 40, matched).watts)
    expect(powerRating(lmr, 450, 100, matched).watts).toBe(0)
  })
  it('switches to the voltage limit when the working voltage is low', () => {
    const r = powerRating({ ...cableById('rg174')!, vrms: 100 }, 1, 40, mismatch(0.01, 1))
    expect(r.limit).toBe('voltage')
    expect(r.watts).toBeCloseTo((100 * 100) / 50, 0)
  })
})

describe('compute', () => {
  it('computes loss and output power for 30 m of LMR-400 at 435 MHz', () => {
    const c = cableById('lmr400')!
    const r = compute({ ...DEFAULTS, cable: 'lmr400', len: 30, lenUnit: 'm', freq: 435, freqUnit: 'MHz', vswr: 1, conn: 0, power: 100, powerUnit: 'W' })
    const per100ft = r.per100m * 0.3048
    expect(per100ft).toBeCloseTo(2.65, 0)
    expect(r.lineLossDb).toBeCloseTo((r.per100m * 30) / 100, 9)
    expect(r.pOutW).toBeCloseTo(100 * Math.pow(10, -r.lineLossDb / 10), 6)
    expect(r.heatW).toBeCloseTo(100 - r.pOutW, 6)
    expect(r.cable).toBe(c)
  })
  it('doubles loss in dB when the length doubles', () => {
    const a = compute({ ...DEFAULTS, len: 10, vswr: 1 })
    const b = compute({ ...DEFAULTS, len: 20, vswr: 1 })
    expect(b.lineLossDb).toBeCloseTo(2 * a.lineLossDb, 9)
  })
  it('handles feet and units', () => {
    expect(lenToM(100, 'ft')).toBeCloseTo(30.48, 9)
    expect(powerToW(1, 'kW')).toBe(1000)
    expect(powerToW(30, 'dBm')).toBeCloseTo(1, 9)
    expect(wToPower(1, 'dBm')).toBeCloseTo(30, 9)
    expect(compute({ ...DEFAULTS, len: 100, lenUnit: 'ft' }).lenM).toBeCloseTo(30.48, 9)
  })
  it('conserves power: in = out + heat + connector loss', () => {
    const r = compute({ ...DEFAULTS, vswr: 2.5, conn: 0.5 })
    const toLoad = r.pOutW / Math.pow(10, -0.5 / 10)
    expect(r.pInW).toBeCloseTo(toLoad + r.heatW, 9)
    expect(r.totalDb).toBeCloseTo(-10 * Math.log10(r.pOutW / r.pInW), 9)
  })
  it('solves the length for 3 dB loss', () => {
    const r = compute({ ...DEFAULTS, targetDb: 3 })
    expect(compute({ ...DEFAULTS, len: r.maxLenM, lenUnit: 'm', vswr: 1 }).lineLossDb).toBeCloseTo(3, 6)
  })
  it('flags frequencies above the cable limit and builds a summary', () => {
    const r = compute({ ...DEFAULTS, cable: 'rg58', freq: 2.4, freqUnit: 'GHz' })
    expect(r.aboveFmax).toBe(true)
    expect(summary(DEFAULTS, r, (m) => `${m} m`)).toContain('RG-58')
  })
  it('supports a custom cable', () => {
    const r = compute({ ...DEFAULTS, cable: 'custom', cK1: 1, cK2: 0, freq: 100, freqUnit: 'MHz', len: 100, lenUnit: 'm', vswr: 1 })
    expect(r.per100m).toBeCloseTo(10, 9)
    expect(r.lineLossDb).toBeCloseTo(10, 9)
  })
})
