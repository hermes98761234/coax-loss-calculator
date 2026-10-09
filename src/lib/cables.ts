/** Coax cable database. Attenuation is modelled as A(f) = k1·√f + k2·f (dB per 100 m, f in MHz). */

export interface Cable {
  id: string
  name: string
  /** Characteristic impedance, ohm. */
  z0: number
  /** Velocity factor (0..1). */
  vf: number
  /** Outer diameter, mm. */
  od: number
  /** Maximum conductor/dielectric operating temperature, °C. */
  tmax: number
  /** Average CW power rating at 100 MHz and 40 °C ambient, matched load, W. */
  p100: number
  /** Working voltage, V RMS. */
  vrms: number
  /** Upper usable frequency, GHz. */
  fmaxGhz: number
  /** Datasheet points [MHz, dB per 100 m] the k1/k2 model is fitted to. */
  points: [number, number][]
  /** Skin-effect (conductor) term, dB/100 m/√MHz. */
  k1: number
  /** Dielectric term, dB/100 m/MHz. */
  k2: number
}

const FT = 100 / 30.48 // dB per 100 ft → dB per 100 m

/**
 * Least-squares fit of A = k1·√f + k2·f to datasheet points, minimising relative error.
 * Both coefficients are kept non-negative (physical).
 */
export function fitK(points: [number, number][]): { k1: number; k2: number } {
  let s11 = 0, s12 = 0, s22 = 0, b1 = 0, b2 = 0
  for (const [f, a] of points) {
    const x1 = Math.sqrt(f) / a
    const x2 = f / a
    s11 += x1 * x1; s12 += x1 * x2; s22 += x2 * x2; b1 += x1; b2 += x2
  }
  const det = s11 * s22 - s12 * s12
  let k1 = (b1 * s22 - b2 * s12) / det
  let k2 = (s11 * b2 - s12 * b1) / det
  if (k2 < 0) { k2 = 0; k1 = b1 / s11 }
  else if (k1 < 0) { k1 = 0; k2 = b2 / s22 }
  return { k1, k2 }
}

type Spec = Omit<Cable, 'k1' | 'k2' | 'points'> & { points: [number, number][] }
const mk = (s: Spec): Cable => ({ ...s, ...fitK(s.points) })
const ft = (pts: [number, number][]): [number, number][] => pts.map(([f, a]) => [f, a * FT])

/** Datasheet-style values from manufacturer catalogues (Times Microwave, Belden, Messi & Paoloni, CommScope). Approximate. */
export const CABLES: Cable[] = [
  mk({ id: 'rg174', name: 'RG-174', z0: 50, vf: 0.66, od: 2.8, tmax: 80, p100: 55, vrms: 1100, fmaxGhz: 3,
    points: ft([[10, 3.4], [100, 10.4], [400, 20.6], [1000, 33], [2400, 55]]) }),
  mk({ id: 'rg316', name: 'RG-316', z0: 50, vf: 0.7, od: 2.5, tmax: 200, p100: 120, vrms: 900, fmaxGhz: 3,
    points: ft([[100, 8], [400, 15.5], [1000, 25.5], [3000, 46]]) }),
  mk({ id: 'rg58', name: 'RG-58', z0: 50, vf: 0.66, od: 4.95, tmax: 80, p100: 250, vrms: 1400, fmaxGhz: 1,
    points: ft([[1, 0.4], [10, 1.4], [50, 3.3], [100, 4.9], [200, 7.3], [400, 11.2], [700, 16.9], [900, 19.8], [1000, 21.5]]) }),
  mk({ id: 'rg8x', name: 'RG-8X', z0: 50, vf: 0.78, od: 6.1, tmax: 80, p100: 400, vrms: 1500, fmaxGhz: 1,
    points: ft([[10, 1.1], [50, 2.5], [100, 3.7], [400, 8], [1000, 13]]) }),
  mk({ id: 'rg213', name: 'RG-213', z0: 50, vf: 0.66, od: 10.3, tmax: 80, p100: 1100, vrms: 3700, fmaxGhz: 1,
    points: ft([[10, 0.6], [50, 1.3], [100, 1.9], [200, 2.8], [400, 4.5], [1000, 8]]) }),
  mk({ id: 'rg59', name: 'RG-59 (75 Ω)', z0: 75, vf: 0.66, od: 6.15, tmax: 80, p100: 350, vrms: 1700, fmaxGhz: 1,
    points: ft([[50, 2.4], [100, 3.4], [400, 7], [1000, 11.5]]) }),
  mk({ id: 'rg6', name: 'RG-6 foam (75 Ω)', z0: 75, vf: 0.83, od: 6.9, tmax: 75, p100: 500, vrms: 1800, fmaxGhz: 3,
    points: ft([[55, 1.4], [211, 2.8], [550, 4.6], [750, 5.5], [1000, 6.5]]) }),
  mk({ id: 'lmr240', name: 'LMR-240', z0: 50, vf: 0.84, od: 6.1, tmax: 85, p100: 640, vrms: 1250, fmaxGhz: 6,
    points: ft([[50, 1.7], [150, 3], [450, 5.3], [900, 7.6], [1500, 9.9], [2000, 11.5], [2500, 12.9], [5800, 21]]) }),
  mk({ id: 'lmr400', name: 'LMR-400', z0: 50, vf: 0.85, od: 10.3, tmax: 85, p100: 1400, vrms: 2500, fmaxGhz: 6,
    points: ft([[50, 0.9], [150, 1.5], [450, 2.7], [900, 3.9], [1500, 5.1], [2000, 6], [2500, 6.8], [5800, 10.8]]) }),
  mk({ id: 'lmr600', name: 'LMR-600', z0: 50, vf: 0.87, od: 14.9, tmax: 85, p100: 2600, vrms: 4000, fmaxGhz: 6,
    points: ft([[50, 0.6], [150, 1], [450, 1.7], [900, 2.5], [1500, 3.3], [2000, 3.8], [2500, 4.3], [5800, 7.2]]) }),
  mk({ id: 'aircell7', name: 'Aircell 7', z0: 50, vf: 0.83, od: 7.3, tmax: 80, p100: 800, vrms: 2000, fmaxGhz: 3,
    points: [[28, 3.6], [144, 8], [432, 14], [1296, 25.5], [2400, 35], [5800, 56]] }),
  mk({ id: 'ecoflex10', name: 'Ecoflex 10', z0: 50, vf: 0.85, od: 10.2, tmax: 80, p100: 1300, vrms: 2700, fmaxGhz: 6,
    points: [[28, 2.7], [144, 5.9], [432, 10.6], [1296, 19.5], [2400, 27], [5800, 44]] }),
  mk({ id: 'ecoflex15', name: 'Ecoflex 15', z0: 50, vf: 0.86, od: 14.6, tmax: 80, p100: 2400, vrms: 4000, fmaxGhz: 6,
    points: [[28, 1.7], [144, 3.6], [432, 6.5], [1296, 12], [2400, 16.8], [5800, 27.5]] }),
  mk({ id: 'h155', name: 'H155', z0: 50, vf: 0.79, od: 5.4, tmax: 80, p100: 700, vrms: 1500, fmaxGhz: 3,
    points: [[28, 4], [144, 9.2], [432, 15.6], [1296, 29], [2400, 42], [5800, 70]] }),
  mk({ id: 'ldf4', name: 'Heliax 1/2" (LDF4-50A)', z0: 50, vf: 0.88, od: 16, tmax: 85, p100: 4000, vrms: 1500, fmaxGhz: 8.8,
    points: ft([[30, 0.39], [100, 0.7], [450, 1.5], [900, 2.2], [2000, 3.4], [5000, 5.7]]) }),
  mk({ id: 'ldf5', name: 'Heliax 7/8" (LDF5-50A)', z0: 50, vf: 0.89, od: 28, tmax: 85, p100: 8500, vrms: 2200, fmaxGhz: 5,
    points: ft([[30, 0.22], [100, 0.4], [450, 0.85], [900, 1.25], [2000, 1.9], [5000, 3.2]]) }),
]

export const cableById = (id: string): Cable | undefined => CABLES.find((c) => c.id === id)

/** Attenuation of a matched cable, dB per 100 m. */
export const attenuation100m = (c: Pick<Cable, 'k1' | 'k2'>, fMHz: number): number => c.k1 * Math.sqrt(fMHz) + c.k2 * fMHz
