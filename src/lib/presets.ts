import type { Inputs } from './coax'

export const DEFAULTS: Inputs = {
  cable: 'lmr400',
  cK1: 0.4,
  cK2: 0.002,
  cVf: 0.8,
  cZ0: 50,
  cP100: 500,
  cTmax: 80,
  len: 30,
  lenUnit: 'm',
  freq: 435,
  freqUnit: 'MHz',
  power: 50,
  powerUnit: 'W',
  vswr: 1.5,
  ambient: 25,
  conn: 0.3,
  targetDb: 3,
}

export interface Preset {
  id: string
  name: string
  patch: Partial<Inputs>
  compare: string[]
}

export const PRESETS: Preset[] = [
  { id: 'uhf', name: '70 cm FM repeater feed, 30 m', patch: {}, compare: ['rg213', 'lmr400', 'lmr600', 'ldf4'] },
  { id: 'hf', name: 'HF 100 W to a 20 m dipole, RG-213', patch: { cable: 'rg213', len: 20, freq: 14.2, power: 100, vswr: 2, conn: 0.2 }, compare: ['rg58', 'rg213', 'lmr400'] },
  { id: 'hf-legal', name: 'HF 1.5 kW linear on 7 MHz, LMR-600', patch: { cable: 'lmr600', len: 40, freq: 7.1, power: 1.5, powerUnit: 'kW', vswr: 1.8, ambient: 35 }, compare: ['rg213', 'lmr400', 'lmr600'] },
  { id: 'vhf', name: '2 m station, 25 m Aircell 7', patch: { cable: 'aircell7', len: 25, freq: 145, power: 50, vswr: 1.3 }, compare: ['rg58', 'aircell7', 'ecoflex10', 'ecoflex15'] },
  { id: 'wifi', name: 'Wi-Fi 2.4 GHz outdoor antenna, 10 m', patch: { cable: 'lmr400', len: 10, freq: 2.4, freqUnit: 'GHz', power: 100, powerUnit: 'mW', vswr: 1.5, conn: 0.4 }, compare: ['rg58', 'lmr240', 'lmr400', 'lmr600'] },
  { id: 'wifi58', name: 'Wi-Fi 5.8 GHz, 5 m of LMR-240', patch: { cable: 'lmr240', len: 5, freq: 5.8, freqUnit: 'GHz', power: 200, powerUnit: 'mW', vswr: 1.6, conn: 0.5 }, compare: ['lmr240', 'lmr400', 'lmr600'] },
  { id: 'adsb', name: 'ADS-B 1090 MHz receiver, 15 m RG-6', patch: { cable: 'rg6', len: 15, freq: 1090, power: 1, powerUnit: 'mW', vswr: 2, conn: 0.2 }, compare: ['rg6', 'rg58', 'lmr240', 'lmr400'] },
  { id: 'gps', name: 'GPS L1 1575 MHz antenna, 8 m', patch: { cable: 'lmr240', len: 8, freq: 1575.42, power: -130, powerUnit: 'dBm', vswr: 1.5, conn: 0.2 }, compare: ['rg174', 'rg316', 'lmr240', 'lmr400'] },
  { id: 'lora', name: 'LoRa 868 MHz pigtail, 1 m RG-316', patch: { cable: 'rg316', len: 1, freq: 868, power: 25, powerUnit: 'mW', vswr: 1.8, conn: 0.3 }, compare: ['rg174', 'rg316', 'rg58'] },
  { id: 'feedline', name: 'Broadcast-grade 7/8" Heliax, 60 m at 450 MHz', patch: { cable: 'ldf5', len: 60, freq: 450, power: 500, vswr: 1.2, ambient: 40, conn: 0.2 }, compare: ['lmr600', 'ldf4', 'ldf5'] },
]
