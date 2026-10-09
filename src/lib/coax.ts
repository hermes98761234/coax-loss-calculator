import { attenuation100m, cableById, type Cable } from './cables'

export const SPEED_OF_LIGHT = 299792458
export type LenUnit = 'm' | 'ft'
export type FreqUnit = 'MHz' | 'GHz'
export type PowerUnit = 'mW' | 'W' | 'kW' | 'dBm'

export interface Inputs {
  cable: string
  /** Custom cable, used when cable === 'custom'. */
  cK1: number
  cK2: number
  cVf: number
  cZ0: number
  cP100: number
  cTmax: number
  len: number
  lenUnit: LenUnit
  freq: number
  freqUnit: FreqUnit
  power: number
  powerUnit: PowerUnit
  vswr: number
  ambient: number
  /** Total connector/adapter loss, dB. */
  conn: number
  /** Target loss for the maximum-length solver, dB. */
  targetDb: number
}

export const M_PER_FT = 0.3048
export const lenToM = (v: number, u: LenUnit) => (u === 'ft' ? v * M_PER_FT : v)
export const mToLen = (m: number, u: LenUnit) => (u === 'ft' ? m / M_PER_FT : m)
export const freqToMHz = (v: number, u: FreqUnit) => (u === 'GHz' ? v * 1000 : v)
export function powerToW(v: number, u: PowerUnit): number {
  switch (u) {
    case 'mW': return v / 1000
    case 'W': return v
    case 'kW': return v * 1000
    case 'dBm': return Math.pow(10, (v - 30) / 10)
  }
}
export function wToPower(w: number, u: PowerUnit): number {
  switch (u) {
    case 'mW': return w * 1000
    case 'W': return w
    case 'kW': return w / 1000
    case 'dBm': return 10 * Math.log10(w) + 30
  }
}

export function customCable(i: Inputs): Cable {
  return {
    id: 'custom', name: 'Custom cable', z0: i.cZ0, vf: i.cVf, od: 0, tmax: i.cTmax, p100: i.cP100, vrms: Infinity,
    fmaxGhz: Infinity, points: [], k1: i.cK1, k2: i.cK2,
  }
}
export function cableOf(i: Inputs): Cable {
  return (i.cable === 'custom' ? customCable(i) : cableById(i.cable)) ?? customCable(i)
}

export const vswrToGamma = (s: number) => (s <= 1 ? 0 : Number.isFinite(s) ? (s - 1) / (s + 1) : 1)
export const gammaToVswr = (g: number) => (g >= 1 ? Infinity : (1 + g) / (1 - g))

export interface Mismatch {
  /** Matched one-way power transmission a² (linear). */
  a2: number
  /** Load reflection coefficient magnitude. */
  gammaL: number
  /** VSWR seen at the input of the line. */
  vswrIn: number
  /** Extra loss caused by the load mismatch, dB. */
  extraLossDb: number
  /** Worst local heating relative to a matched line carrying the same incident power. */
  hotSpot: number
  /** Worst peak voltage relative to the incident voltage at the input. */
  voltPeak: number
}

/**
 * Effect of a load VSWR on a lossy line. `lineLossDb` is the matched loss of the whole line.
 * Extra loss = (1 − Γ²a⁴) / (1 − Γ²), the classic "additional loss due to SWR".
 */
export function mismatch(lineLossDb: number, vswrLoad: number): Mismatch {
  const a2 = Math.pow(10, -lineLossDb / 10)
  const g = vswrToGamma(vswrLoad)
  const g2 = g * g
  const extra = g2 >= 1 ? Infinity : (1 - g2 * a2 * a2) / (1 - g2)
  const a = Math.sqrt(a2)
  return {
    a2,
    gammaL: g,
    vswrIn: gammaToVswr(g * a2),
    extraLossDb: 10 * Math.log10(extra),
    hotSpot: Math.max(1 + g2 * a2 * a2, a2 * (1 + g2)),
    voltPeak: Math.max(1 + g * a2, a * (1 + g)),
  }
}

export interface Rating {
  /** Rated average power into the line at the given frequency/temperature/VSWR, W. */
  watts: number
  limit: 'thermal' | 'voltage'
  /** Matched rating at 100 MHz and 40 °C, W. */
  base: number
  freqFactor: number
  tempFactor: number
  vswrFactor: number
  /** Matched, same frequency/temperature, W. */
  matchedWatts: number
}

/**
 * Average power rating, expressed as net power into the cable. The datasheet value at 100 MHz scales with
 * the inverse of attenuation (heat per metre), linearly with the allowed temperature rise, and is cut by the
 * standing-wave hot spot and peak voltage.
 */
export function powerRating(c: Cable, fMHz: number, ambientC: number, mm: Mismatch): Rating {
  const freqFactor = attenuation100m(c, 100) / attenuation100m(c, fMHz)
  const tempFactor = Math.max(0, (c.tmax - ambientC) / (c.tmax - 40))
  const matchedWatts = c.p100 * freqFactor * tempFactor
  const net = 1 - mm.gammaL * mm.gammaL * mm.a2 * mm.a2 // net/incident power at the input
  const thermal = (matchedWatts / mm.hotSpot) * net
  const vInc = c.vrms / mm.voltPeak
  const voltage = Number.isFinite(vInc) ? ((vInc * vInc) / c.z0) * net : Infinity
  const limit = voltage < thermal ? 'voltage' : 'thermal'
  const watts = Math.min(thermal, voltage)
  return { watts, limit, base: c.p100, freqFactor, tempFactor, vswrFactor: matchedWatts > 0 ? watts / matchedWatts : 0, matchedWatts }
}

export interface Electrical {
  /** Wavelength in free space, m. */
  lambda0: number
  /** Wavelength in the cable, m. */
  lambdaCable: number
  /** Electrical length, degrees. */
  degrees: number
  wavelengths: number
  /** One-way delay, ns. */
  delayNs: number
  quarterWaveM: number
  halfWaveM: number
  /** Capacitance per metre, pF/m. */
  capPfPerM: number
}

export function electrical(c: Cable, fMHz: number, lenM: number): Electrical {
  const lambda0 = SPEED_OF_LIGHT / (fMHz * 1e6)
  const lambdaCable = lambda0 * c.vf
  const wavelengths = lenM / lambdaCable
  return {
    lambda0,
    lambdaCable,
    degrees: wavelengths * 360,
    wavelengths,
    delayNs: (lenM / (SPEED_OF_LIGHT * c.vf)) * 1e9,
    quarterWaveM: lambdaCable / 4,
    halfWaveM: lambdaCable / 2,
    capPfPerM: (1 / (c.z0 * SPEED_OF_LIGHT * c.vf)) * 1e12,
  }
}

export interface Result {
  cable: Cable
  fMHz: number
  lenM: number
  pInW: number
  /** Matched attenuation, dB per 100 m. */
  per100m: number
  lineLossDb: number
  mm: Mismatch
  connDb: number
  totalDb: number
  pOutW: number
  /** Heat dissipated in the cable, W. */
  heatW: number
  efficiency: number
  rating: Rating
  /** Input power as a fraction of the rating. */
  usage: number
  elec: Electrical
  /** Length at which matched loss equals the target, m. */
  maxLenM: number
  aboveFmax: boolean
}

export function compute(i: Inputs, cable = cableOf(i)): Result {
  const fMHz = freqToMHz(i.freq, i.freqUnit)
  const lenM = lenToM(i.len, i.lenUnit)
  const pInW = powerToW(i.power, i.powerUnit)
  const per100m = attenuation100m(cable, fMHz)
  const lineLossDb = (per100m * lenM) / 100
  const mm = mismatch(lineLossDb, i.vswr)
  const toLoad = pInW * Math.pow(10, -(lineLossDb + mm.extraLossDb) / 10)
  const pOutW = toLoad * Math.pow(10, -i.conn / 10)
  const rating = powerRating(cable, fMHz, i.ambient, mm)
  return {
    cable, fMHz, lenM, pInW, per100m, lineLossDb, mm, connDb: i.conn,
    totalDb: lineLossDb + mm.extraLossDb + i.conn,
    pOutW,
    heatW: pInW - toLoad,
    efficiency: pInW > 0 ? pOutW / pInW : 0,
    rating,
    usage: rating.watts > 0 ? pInW / rating.watts : Infinity,
    elec: electrical(cable, fMHz, lenM),
    maxLenM: per100m > 0 ? (i.targetDb / per100m) * 100 : Infinity,
    aboveFmax: fMHz > cable.fmaxGhz * 1000,
  }
}

export function summary(i: Inputs, r: Result, len: (m: number) => string): string {
  const f = (n: number, d = 2) => n.toFixed(d)
  return [
    `${r.cable.name}, ${len(r.lenM)}, ${f(r.fMHz, r.fMHz < 10 ? 3 : 1)} MHz, VSWR ${f(i.vswr)}:1`,
    `Matched loss: ${f(r.per100m)} dB/100 m, ${f(r.lineLossDb)} dB on this length`,
    `VSWR extra loss: ${f(r.mm.extraLossDb, 3)} dB; connectors: ${f(r.connDb)} dB; total: ${f(r.totalDb)} dB`,
    `Power: ${f(r.pInW, 2)} W in, ${f(r.pOutW, 2)} W out (${f(r.efficiency * 100, 1)} %), ${f(r.heatW, 2)} W heat`,
    `Power rating (avg): ${f(r.rating.watts, 0)} W, ${f(r.usage * 100, 0)} % used, limited by ${r.rating.limit}`,
    `Velocity factor ${f(r.cable.vf)}: ${f(r.elec.degrees, 1)} electrical degrees, ${f(r.elec.delayNs, 1)} ns`,
  ].join('\n')
}
