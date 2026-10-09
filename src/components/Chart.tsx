import { niceTicks } from '../lib/ticks'
import type { T } from '../i18n'

export interface Series {
  id: string
  name: string
  color: string
  pts: [number, number][]
  /** Datasheet points drawn as dots. */
  dots?: [number, number][]
  bold?: boolean
}

const W = 760
const H = 380
const M = { l: 52, r: 16, t: 14, b: 44 }
const MIN_F = 1
const MAX_F = 10000


export default function Chart({ series, logY, yUnit, fMHz, yAt, label, t }: {
  series: Series[]
  logY: boolean
  yUnit: string
  fMHz: number
  /** Y value of the selected cable at the current frequency. */
  yAt: number
  label: string
  t: T
}) {
  const all = series.flatMap((s) => s.pts.map((p) => p[1])).filter((v) => v > 0 && Number.isFinite(v))
  const x0 = M.l
  const x1 = W - M.r
  const yb = H - M.b
  const lx = (f: number) => x0 + ((Math.log(f) - Math.log(MIN_F)) / (Math.log(MAX_F) - Math.log(MIN_F))) * (x1 - x0)
  let y: (v: number) => number
  let yTicks: { v: number; label: string }[]
  if (logY) {
    const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...all, yAt || Infinity))))
    const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...all, yAt || 0))))
    y = (v) => M.t + ((Math.log10(hi) - Math.log10(Math.max(v, lo))) / (Math.log10(hi) - Math.log10(lo))) * (yb - M.t)
    yTicks = []
    for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e++) yTicks.push({ v: Math.pow(10, e), label: String(Math.pow(10, e)) })
  } else {
    const hi = Math.max(...all, yAt, 1)
    const ticks = niceTicks(0, hi * 1.05, 6)
    const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1
    const top = Math.max(ticks[ticks.length - 1], Math.ceil(hi / step) * step)
    if (top > ticks[ticks.length - 1]) ticks.push(top)
    y = (v) => M.t + ((top - v) / top) * (yb - M.t)
    yTicks = ticks.map((v) => ({ v, label: String(v) }))
  }
  const xTicks: number[] = []
  for (let e = 0; e <= 4; e++) for (const m of [1, 2, 5]) {
    const v = m * Math.pow(10, e)
    if (v <= MAX_F) xTicks.push(v)
  }
  const major = (v: number) => /^[1]0*$/.test(String(v))
  const fmtF = (v: number) => (v >= 1000 ? `${v / 1000}G` : String(v))
  const path = (pts: [number, number][]) => pts.filter((p) => p[1] > 0).map((p, i) => `${i ? 'L' : 'M'}${lx(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
  const cx = lx(Math.min(Math.max(fMHz, MIN_F), MAX_F))
  return (
    <div className="chart-scroll">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ minWidth: 560 }}>
        {yTicks.map((tk) => (
          <g key={tk.v}>
            <line x1={x0} x2={x1} y1={y(tk.v)} y2={y(tk.v)} className="gridline" />
            <text x={x0 - 6} y={y(tk.v) + 3.5} textAnchor="end" className="axis">{tk.label}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={v}>
            <line x1={lx(v)} x2={lx(v)} y1={M.t} y2={yb} className={major(v) ? 'gridline strong' : 'gridline'} />
            <text x={lx(v)} y={yb + 14} textAnchor="middle" className="axis">{fmtF(v)}</text>
          </g>
        ))}
        <text x={(x0 + x1) / 2} y={H - 6} textAnchor="middle" className="axis">{t('Frequency')}, MHz (G = GHz, log)</text>
        <text x={12} y={M.t + 8} className="axis" transform={`rotate(-90 12 ${M.t + 8})`} textAnchor="end">{yUnit}</text>
        {[...series].reverse().map((s) => (
          <g key={s.id}>
            <path d={path(s.pts)} fill="none" stroke={s.color} strokeWidth={s.bold ? 3 : 1.8} strokeLinejoin="round" />
            {s.dots?.map(([f, v]) => <circle key={f} cx={lx(f)} cy={y(v)} r={3} fill={s.color} stroke="var(--chart-bg)" strokeWidth={1} />)}
          </g>
        ))}
        <line x1={cx} x2={cx} y1={M.t} y2={yb} className="mark-line" />
        {yAt > 0 && <circle cx={cx} cy={y(yAt)} r={5} fill="var(--chart-bg)" stroke="var(--fg)" strokeWidth={2} />}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.id}><i className="sw" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
    </div>
  )
}
