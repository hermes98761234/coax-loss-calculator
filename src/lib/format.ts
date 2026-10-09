/** Compact number formatting: significant digits, no exponent for normal magnitudes. */
export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : '–'
  if (n === 0) return '0'
  const a = Math.abs(n)
  const s = a >= 1e6 || a < 1e-3 ? n.toExponential(digits - 1) : String(Number(n.toPrecision(digits)))
  return s.replace('-', '−')
}

/** Fixed decimals with a real minus sign. */
export const fix = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('-', '−') : '–')

/** Power in W with a sensible prefix. */
export function fmtPower(w: number): string {
  if (!Number.isFinite(w)) return '∞'
  const a = Math.abs(w)
  if (a >= 1000) return `${fmt(w / 1000, 3)} kW`
  if (a >= 1) return `${fmt(w, 3)} W`
  if (a >= 1e-3) return `${fmt(w * 1e3, 3)} mW`
  if (a >= 1e-6) return `${fmt(w * 1e6, 3)} µW`
  if (a >= 1e-9) return `${fmt(w * 1e9, 3)} nW`
  return `${fmt(w * 1e12, 3)} pW`
}
