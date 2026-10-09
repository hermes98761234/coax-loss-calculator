import { useEffect, useMemo, useState } from 'react'
import { CABLES, attenuation100m } from './lib/cables'
import { cableOf, compute, freqToMHz, lenToM, mToLen, summary, wToPower, type FreqUnit, type Inputs, type LenUnit, type PowerUnit } from './lib/coax'
import { fix, fmt, fmtPower } from './lib/format'
import { invalidFields, loadState, saveState, type AppState } from './lib/model'
import { DEFAULTS, PRESETS } from './lib/presets'
import { tr, type T } from './i18n'
import NumberField from './components/NumberField'
import Chart, { type Series } from './components/Chart'
import { PALETTE } from './lib/palette'

const REPO = 'https://github.com/hermes98761234/coax-loss-calculator'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'err' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={'stat-value' + (tone ? ' ' + tone : '')}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

type ChartMode = 'loss' | 'power'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [mode, setMode] = useState<ChartMode>('loss')
  const [copied, setCopied] = useState(false)
  const { inputs: inp, settings } = state
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const bad = useMemo(() => invalidFields(inp), [inp])
  const valid = bad.size === 0
  const r = useMemo(() => (valid ? compute(inp) : null), [inp, valid])

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setState((s) => ({ ...s, inputs: { ...s.inputs, [k]: v }, preset: 'custom' }))
  const num = (k: keyof Inputs) => (v: number) => set(k, v as never)

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setState((s) => ({ ...s, inputs: { ...DEFAULTS, ...p.patch }, preset: id, compare: [...p.compare] }))
  }
  const toggleCompare = (id: string) =>
    setState((s) => ({ ...s, compare: s.compare.includes(id) ? s.compare.filter((c) => c !== id) : [...s.compare, id] }))
  const pickCable = (id: string) => setState((s) => ({ ...s, inputs: { ...s.inputs, cable: id }, preset: 'custom' }))

  const lu = inp.lenUnit
  const lenStr = (m: number) => `${fmt(mToLen(m, lu), 3)} ${lu}`
  const copy = async () => {
    if (!r) return
    try {
      await navigator.clipboard.writeText(summary(inp, r, lenStr))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  // Chart data: selected cable plus the compared ones, sampled on a log frequency axis.
  const customName = t('Custom cable')
  const series = useMemo<Series[]>(() => {
    if (!valid) return []
    const lenM = lenToM(inp.len, inp.lenUnit)
    const sel = cableOf(inp)
    const others = CABLES.filter((c) => state.compare.includes(c.id) && c.id !== sel.id)
    const N = 90
    const make = (c: typeof sel, color: string, bold: boolean): Series => {
      const fTop = Math.min(10000, c.fmaxGhz * 1000)
      const pts: [number, number][] = []
      for (let i = 0; i <= N; i++) {
        const f = Math.pow(10, (4 * i) / N)
        if (f > fTop * 1.0001) break
        const y = mode === 'loss' ? (attenuation100m(c, f) * lenM) / 100 : compute({ ...inp, freq: f, freqUnit: 'MHz' }, c).rating.watts
        pts.push([f, y])
      }
      return { id: c.id, name: c.name === 'Custom cable' ? customName : c.name, color, pts, bold, dots: bold && mode === 'loss' ? c.points.filter((p) => p[0] <= 10000).map(([f, a]) => [f, (a * lenM) / 100]) : undefined }
    }
    return [make(sel, PALETTE[0], true), ...others.map((c, i) => make(c, PALETTE[(i + 1) % PALETTE.length], false))]
  }, [inp, valid, state.compare, mode, customName])

  const rows = useMemo(() => {
    if (!valid) return []
    return CABLES.map((c) => compute(inp, c)).sort((a, b) => a.totalDb - b.totalDb)
  }, [inp, valid])

  const usageTone = r ? (r.usage > 1 ? 'err' : r.usage > 0.8 ? 'warn' : 'ok') : undefined
  const verdict = (() => {
    if (!r) return null
    if (r.usage > 1) return { cls: 'err', msg: t('Over the power rating: {0} W is {1}% of the {2} W rating.', fix(r.pInW, r.pInW < 10 ? 2 : 0), fix(r.usage * 100, 0), fix(r.rating.watts, 0)) }
    if (r.usage > 0.8) return { cls: 'warn', msg: t('Close to the power rating: {0}% used. Leave headroom for temperature and mismatch.', fix(r.usage * 100, 0)) }
    return { cls: 'ok', msg: t('Within the power rating ({0}% used). {1} dB total loss, {2}% of the power arrives.', fix(r.usage * 100, 0), fix(r.totalDb, 2), fix(r.efficiency * 100, 1)) }
  })()
  const sel = cableOf(inp)

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Coax loss calculator')}</span>
        <span className="hint grow">{t('Cable attenuation, VSWR loss, power handling and electrical length for common coax.')}</span>
        <label className="inline-label">
          {t('Language')}
          <select value={settings.lang} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, lang: e.target.value as 'en' | 'uk' } }))}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label className="inline-label">
          {t('Theme')}
          <select value={settings.theme} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, theme: e.target.value as 'auto' | 'light' | 'dark' } }))}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <Section title={t('Preset')}>
              <div className="field">
                <select aria-label={t('Preset')} value={state.preset} onChange={(e) => applyPreset(e.target.value)}>
                  {state.preset === 'custom' && <option value="custom">{t('Custom')}</option>}
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{t(p.name)}</option>
                  ))}
                </select>
              </div>
            </Section>

            <Section title={t('Cable')}>
              <div className="field">
                <select aria-label={t('Cable')} value={inp.cable} onChange={(e) => pickCable(e.target.value)}>
                  {CABLES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="custom">{t('Custom cable')}</option>
                </select>
              </div>
              {inp.cable === 'custom' ? (
                <>
                  <div className="grid2">
                    <NumberField label={t('k1 (dB/100 m/√MHz)')} value={inp.cK1} bad={bad.has('cK1')} onChange={num('cK1')} title={t('Skin-effect term of A = k1·√f + k2·f')} />
                    <NumberField label={t('k2 (dB/100 m/MHz)')} value={inp.cK2} bad={bad.has('cK2')} onChange={num('cK2')} title={t('Dielectric term of A = k1·√f + k2·f')} />
                    <NumberField label={t('Velocity factor')} value={inp.cVf} bad={bad.has('cVf')} onChange={num('cVf')} />
                    <NumberField label={t('Impedance')} value={inp.cZ0} bad={bad.has('cZ0')} onChange={num('cZ0')} suffix="Ω" />
                    <NumberField label={t('Power at 100 MHz')} value={inp.cP100} bad={bad.has('cP100')} onChange={num('cP100')} suffix="W" title={t('Average power rating at 100 MHz, 40 °C, matched')} />
                    <NumberField label={t('Max temperature')} value={inp.cTmax} bad={bad.has('cTmax')} onChange={num('cTmax')} suffix="°C" />
                  </div>
                </>
              ) : (
                <p className="hint">
                  {sel.z0} Ω · VF {sel.vf} · {sel.od} mm · k1 {fmt(sel.k1, 3)}, k2 {fmt(sel.k2, 3)} · {t('max')} {sel.fmaxGhz} GHz
                </p>
              )}
            </Section>

            <Section title={t('Signal')}>
              <div className="grid2">
                <NumberField label={t('Frequency')} value={inp.freq} bad={bad.has('freq')} onChange={num('freq')}
                  unit={{ value: inp.freqUnit, options: ['MHz', 'GHz'], onChange: (u) => set('freqUnit', u as FreqUnit) }} />
                <NumberField label={t('Input power')} value={inp.power} bad={bad.has('power')} onChange={num('power')}
                  unit={{ value: inp.powerUnit, options: ['mW', 'W', 'kW', 'dBm'], onChange: (u) => {
                    // keep the same physical power when the unit changes
                    const w = r ? r.pInW : 1
                    setState((s) => ({ ...s, inputs: { ...s.inputs, powerUnit: u as PowerUnit, power: Number(wToPower(w, u as PowerUnit).toPrecision(6)) }, preset: 'custom' }))
                  } }} />
              </div>
            </Section>

            <Section title={t('Run')}>
              <div className="grid2">
                <NumberField label={t('Length')} value={inp.len} bad={bad.has('len')} onChange={num('len')}
                  unit={{ value: lu, options: ['m', 'ft'], onChange: (u) => setState((s) => ({ ...s, inputs: { ...s.inputs, lenUnit: u as LenUnit, len: Number(mToLen(lenToM(s.inputs.len, s.inputs.lenUnit), u as LenUnit).toPrecision(6)) } })) }} />
                <NumberField label={t('Load VSWR')} value={inp.vswr} bad={bad.has('vswr')} onChange={num('vswr')} suffix=": 1" title={t('VSWR at the antenna end of the cable')} />
                <NumberField label={t('Ambient temperature')} value={inp.ambient} onChange={num('ambient')} suffix="°C" />
                <NumberField label={t('Connector losses')} value={inp.conn} bad={bad.has('conn')} onChange={num('conn')} suffix="dB" title={t('Total loss of connectors and adapters')} />
              </div>
            </Section>

            <Section title={t('Maximum length')}>
              <NumberField label={t('Allowed cable loss')} value={inp.targetDb} bad={bad.has('targetDb')} onChange={num('targetDb')} suffix="dB" />
              {r && (
                <p className="hint">
                  {t('{0} can run up to {1} at this frequency (matched).', sel.name === 'Custom cable' ? t('Custom cable') : sel.name, lenStr(r.maxLenM))}
                </p>
              )}
            </Section>
          </div>
        </aside>

        <main className="main">
          {!r && <div className="box"><p className="verdict err">{t('Fix the highlighted fields.')}</p></div>}
          {r && verdict && (
            <div className="box">
              <p className={'verdict ' + verdict.cls}>{verdict.msg}</p>
              {r.aboveFmax && <p className="warn-text">{t('{0} is specified up to {1} GHz; the numbers are extrapolated.', r.cable.name, fmt(r.cable.fmaxGhz, 3))}</p>}
              {r.mm.gammaL >= 1 && <p className="warn-text">{t('Total mismatch: no power reaches the load.')}</p>}
              <div className="cards">
                <Stat label={t('Total loss')} value={`${fix(r.totalDb, 2)} dB`}
                  sub={t('cable {0} + VSWR {1} + conn. {2}', fix(r.lineLossDb, 2), fix(r.mm.extraLossDb, 2), fix(r.connDb, 2))} />
                <Stat label={t('Output power')} value={fmtPower(r.pOutW)} sub={t('{0}% of input', fix(r.efficiency * 100, 1))} />
                <Stat label={t('Heat in cable')} value={fmtPower(r.heatW)} sub={t('{0} per metre', fmtPower(r.heatW / r.lenM))} />
                <Stat label={t('Power rating')} value={fmtPower(r.rating.watts)} tone={usageTone}
                  sub={t('{0}% used, {1} limit', fix(r.usage * 100, 0), t(r.rating.limit === 'thermal' ? 'thermal' : 'voltage'))} />
                <Stat label={t('Input VSWR')} value={`${fix(r.mm.vswrIn, 2)} : 1`} sub={t('load {0} : 1', fix(inp.vswr, 2))} />
                <Stat label={t('Electrical length')} value={`${fix(r.elec.degrees, 1)}°`} sub={t('{0} wavelengths, {1} ns', fmt(r.elec.wavelengths, 3), fix(r.elec.delayNs, 1))} />
              </div>
              <div className="row">
                <button type="button" onClick={copy}>{copied ? t('Copied') : t('Copy summary')}</button>
              </div>
            </div>
          )}

          {r && (
            <div className="box">
              <div className="row">
                <h3>{mode === 'loss' ? t('Cable loss versus frequency') : t('Average power rating versus frequency')}</h3>
                <span className="spacer" />
                <button type="button" className={mode === 'loss' ? 'on' : ''} onClick={() => setMode('loss')}>{t('Loss')}</button>
                <button type="button" className={mode === 'power' ? 'on' : ''} onClick={() => setMode('power')}>{t('Power rating')}</button>
              </div>
              <Chart
                series={series}
                logY={mode === 'power'}
                yUnit={mode === 'loss' ? `${t('Loss')}, dB (${lenStr(r.lenM)})` : t('Rating, W')}
                fMHz={r.fMHz}
                yAt={mode === 'loss' ? r.lineLossDb : r.rating.watts}
                label={t('Cable loss versus frequency')}
                t={t}
              />
              <p className="hint">{mode === 'loss' ? t('Dots are datasheet points. Pick more cables in the table below to compare them here.') : t('Rating at your ambient temperature and VSWR. Pick more cables in the table below to compare them here.')}</p>
            </div>
          )}

          {r && (
            <div className="box">
              <h3>{t('Details')}</h3>
              <div className="detail-grid">
                <table className="data">
                  <tbody>
                    <tr><td>{t('Matched attenuation')}</td><td className="num">{fix(r.per100m, 2)} dB/100 m · {fix(r.per100m * 0.3048, 2)} dB/100 ft</td></tr>
                    <tr><td>{t('Cable loss')}</td><td className="num">{fix(r.lineLossDb, 3)} dB</td></tr>
                    <tr><td>{t('Extra loss from VSWR')}</td><td className="num">{fix(r.mm.extraLossDb, 3)} dB</td></tr>
                    <tr><td>{t('Connectors')}</td><td className="num">{fix(r.connDb, 2)} dB</td></tr>
                    <tr className="total"><td>{t('Total loss')}</td><td className="num">{fix(r.totalDb, 3)} dB</td></tr>
                    <tr><td>{t('Input power')}</td><td className="num">{fmtPower(r.pInW)}</td></tr>
                    <tr><td>{t('Output power')}</td><td className="num">{fmtPower(r.pOutW)}</td></tr>
                  </tbody>
                </table>
                <table className="data">
                  <tbody>
                    <tr><td>{t('Rating at 100 MHz, 40 °C, matched')}</td><td className="num">{fmtPower(r.rating.base)}</td></tr>
                    <tr><td>{t('Frequency factor')}</td><td className="num">× {fmt(r.rating.freqFactor, 3)}</td></tr>
                    <tr><td>{t('Temperature factor')}</td><td className="num">× {fmt(r.rating.tempFactor, 3)}</td></tr>
                    <tr><td>{t('VSWR factor')}</td><td className="num">× {fmt(r.rating.vswrFactor, 3)}</td></tr>
                    <tr className="total"><td>{t('Derated average power')}</td><td className="num">{fmtPower(r.rating.watts)}</td></tr>
                    <tr><td>{t('Velocity factor')}</td><td className="num">{r.cable.vf}</td></tr>
                    <tr><td>{t('Wavelength in cable')}</td><td className="num">{fmt(mToLen(r.elec.lambdaCable, lu), 4)} {lu}</td></tr>
                    <tr><td>{t('Quarter-wave length')}</td><td className="num">{fmt(mToLen(r.elec.quarterWaveM, lu), 4)} {lu}</td></tr>
                    <tr><td>{t('Half-wave length')}</td><td className="num">{fmt(mToLen(r.elec.halfWaveM, lu), 4)} {lu}</td></tr>
                    <tr><td>{t('Capacitance')}</td><td className="num">{fmt(r.elec.capPfPerM, 3)} pF/m</td></tr>
                    <tr><td>{t('Free-space wavelength')}</td><td className="num">{fmt(mToLen(r.elec.lambda0, lu), 4)} {lu}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {r && (
            <div className="box">
              <h3>{t('Compare cables')}</h3>
              <p className="hint">{t('All cables at {0}, {1}, load VSWR {2}. Sorted by total loss.', `${fmt(freqToMHz(inp.freq, inp.freqUnit), 4)} MHz`, lenStr(r.lenM), fix(inp.vswr, 2))}</p>
              <div className="chart-scroll">
                <table className="data compare">
                  <thead>
                    <tr>
                      <th>{t('Chart')}</th><th>{t('Cable')}</th><th>{t('Total loss')}</th><th>dB/100 m</th><th>{t('Output power')}</th><th>{t('Power rating')}</th><th>VF</th><th>Ø mm</th><th>Ω</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.cable.id} className={c.cable.id === inp.cable ? 'active' : undefined}>
                        <td>
                          <input type="checkbox" aria-label={`${t('Chart')}: ${c.cable.name}`} checked={state.compare.includes(c.cable.id) || c.cable.id === inp.cable}
                            disabled={c.cable.id === inp.cable} onChange={() => toggleCompare(c.cable.id)} />
                        </td>
                        <td><button type="button" className="link" onClick={() => pickCable(c.cable.id)}>{c.cable.name}</button></td>
                        <td className="num">{fix(c.totalDb, 2)} dB</td>
                        <td className="num">{fix(c.per100m, 1)}</td>
                        <td className="num">{fmtPower(c.pOutW)}</td>
                        <td className={'num' + (c.usage > 1 ? ' err-text' : '')}>{fmtPower(c.rating.watts)}</td>
                        <td className="num">{c.cable.vf}</td>
                        <td className="num">{c.cable.od}</td>
                        <td className="num">{c.cable.z0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
      <p className="hint foot">
        {t('Values are typical datasheet figures fitted to A = k1·√f + k2·f; real cable varies by manufacturer, age and connectors. Power ratings are approximate. Everything runs in your browser.')}{' '}
        <a href={REPO} target="_blank" rel="noreferrer">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
