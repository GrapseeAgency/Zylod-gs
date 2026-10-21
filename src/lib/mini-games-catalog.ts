/**
 * Task 112: THE REAL GAMES — server-truth catalog, question bank and prize
 * tables. The old games page faked gameplay entirely: "Play" hardcoded score
 * 85 client-side and POST /api/mini-games accepted any {gameType, score} at
 * unlimited rate — a points farm redeemable into real ৳ vouchers. Every game
 * is now proven on the server:
 *
 *   wholesale_trivia — the server serves questions WITHOUT answers and
 *     grades the returned answer sheet (real skill, 10 pts per correct,
 *     3 graded attempts/day).
 *   memory_match — the server deals a sequence into a gameChallenges row
 *     (60s expiry, consumed exactly once) and grades the reproduction
 *     position-by-position (20 pts per correct position, 3 rounds/day).
 *   box_picker — pure luck, so the SERVER rolls (like the spin wheel):
 *     2 opens/day, ~1-in-3 crates holds a small voucher, most hold packing
 *     straw — the honest empty result is a real result.
 */

export const GAME_IDS = ['wholesale_trivia', 'memory_match', 'box_picker'] as const
export type GameId = (typeof GAME_IDS)[number]

export const TRIVIA_ATTEMPTS_PER_DAY = 3
export const MEMORY_ROUNDS_PER_DAY = 3
export const BOX_OPENS_PER_DAY = 2
export const MEMORY_SEQUENCE_LENGTH = 6
export const MEMORY_EXPIRY_MS = 60_000
export const TRIVIA_POINTS_PER_CORRECT = 10
export const MEMORY_POINTS_PER_POSITION = 20
/** ~1-in-3 crates holds a voucher. */
export const BOX_WIN_WEIGHT_PERCENT = 34

export const MEMORY_SYMBOLS = [
  'truck', 'container', 'crate', 'pallet', 'forklift', 'vessel', 'scale', 'warehouse',
] as const

export const GAMES_CATALOG: Array<{
  id: GameId
  title: string
  desc: string
  reward: string
  icon: string
  color: string
  dailyLimit: number
}> = [
  {
    id: 'wholesale_trivia',
    title: 'B2B Wholesale Master Quiz',
    desc: 'Real questions on Bangladesh textile trade, HS codes, NBR tax and export logistics — graded by the server.',
    reward: '10 pts per correct answer',
    icon: 'Brain',
    color: '#B91C1C',
    dailyLimit: TRIVIA_ATTEMPTS_PER_DAY,
  },
  {
    id: 'memory_match',
    title: 'Factory Cargo Matcher',
    desc: 'The server deals a cargo sequence — watch it flash, reproduce it. Graded position by position.',
    reward: '20 pts per correct position',
    icon: 'Layers',
    color: '#047857',
    dailyLimit: MEMORY_ROUNDS_PER_DAY,
  },
  {
    id: 'box_picker',
    title: 'Mystery Warehouse Box',
    desc: 'Open crates the server has already sealed: some hold a discount voucher, most hold packing straw.',
    reward: 'Up to ৳80 voucher · luck draw',
    icon: 'Package',
    color: '#B45309',
    dailyLimit: BOX_OPENS_PER_DAY,
  },
]

/** Graded server-side; answers never leave the server. */
export const TRIVIA_BANK: Array<{
  q: string
  options: string[]
  answer: number
}> = [
  { q: 'What does HS Code stand for in Bangladesh export documentation?', options: ['Harmonized System', 'Home Shipment', 'Hold Stock', 'Hand Sale'], answer: 0 },
  { q: 'Which authority assesses customs duty in Bangladesh?', options: ['NBR (National Board of Revenue)', 'BGMEA', 'Bangladesh Bank', 'BSTI'], answer: 0 },
  { q: 'A "dz" (dozen) wholesale bundle contains how many pieces?', options: ['10', '12', '20', '24'], answer: 1 },
  { q: 'Which Incoterm means the seller pays for transport to the buyer\'s port, NOT insurance?', options: ['EXW', 'FOB', 'DDP', 'FCA'], answer: 1 },
  { q: 'What is an LC in wholesale import deals?', options: ['Letter of Credit', 'Local Charge', 'Late Clearance', 'Load Confirmation'], answer: 0 },
  { q: 'Chattogram port handles most of Bangladesh\'s…', options: ['Air cargo', 'Sea freight containers', 'Rail freight', 'River barges only'], answer: 1 },
  { q: 'A supplier quotes "per carton" for 48 pcs. Price per piece is the carton price…', options: ['× 48', '÷ 48', '+ 48', '− 48'], answer: 1 },
  { q: 'MOQ on a wholesale listing means…', options: ['Minimum Order Quantity', 'Maximum Output Quota', 'Mixed Order Quote', 'Monthly Order Volume'], answer: 0 },
  { q: 'VAT on most domestic B2B supplies in Bangladesh is charged at…', options: ['0%', '5%', '15%', '25%'], answer: 2 },
  { q: 'Which document proves goods were shipped on a vessel?', options: ['Bill of Lading', 'Trade License', 'IRC certificate', 'Mushak 6.3'], answer: 0 },
  { q: 'Bin Card in a warehouse tracks…', options: ['Worker attendance', 'Stock in and out per item', 'Buyer complaints', 'Electricity usage'], answer: 1 },
  { q: 'Knit garment exporters commonly certify factories through…', options: ['BGMEA/BKMEA membership', 'Dhaka Chamber only', 'Port authority', 'City corporation'], answer: 0 },
  { q: 'A gross equals how many pieces?', options: ['100', '120', '144', '168'], answer: 2 },
  { q: 'Upcountry delivery from Chattogram port to Dhaka ICD mostly moves by…', options: ['Container train / inland container depot shuttle', 'Air charter', 'Draft animals', 'None — it cannot move'], answer: 0 },
  { q: 'Which payment carries the LEAST risk for the BUYER?', options: ['100% advance', 'Letter of Credit at sight', 'Cash against documents without inspection', 'Consignment after sale'], answer: 1 },
]

export const BOX_VOUCHER_VALUES = [20, 35, 50, 80] as const

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export type TriviaDealItem = { id: number; q: string; options: string[]; _answerPosition: number }

/** Deal a random trivia paper: 10 questions, options shuffled per deal.
 *  The answer position stays server-side — the client only ever sees the paper. */
export function dealTrivia(count = 10): TriviaDealItem[] {
  const pool = shuffle(TRIVIA_BANK.map((item, index) => ({ ...item, id: index })))
  return pool.slice(0, count).map(({ id, q, options, answer }) => {
    const order = shuffle(options.map((_, k) => k))
    return {
      id,
      q,
      options: order.map((k) => options[k]),
      _answerPosition: order.indexOf(answer),
    }
  })
}

/** Strip the grader's answer map before the paper leaves the server. */
export function publicTriviaPaper(deal: TriviaDealItem[]): Array<{ id: number; q: string; options: string[] }> {
  return deal.map(({ id, q, options }) => ({ id, q, options }))
}

/** Grade a returned answer sheet against the deal. Returns the correct count. */
export function gradeTrivia(
  deal: TriviaDealItem[],
  answers: Array<{ id: number; choice: number }>
): number {
  const byId = new Map(answers.map((a) => [a.id, a.choice]))
  let correct = 0
  for (const item of deal) {
    if (byId.get(item.id) === item._answerPosition) correct++
  }
  return correct
}

export function dealMemorySequence(): string[] {
  return Array.from({ length: MEMORY_SEQUENCE_LENGTH }, () =>
    MEMORY_SYMBOLS[Math.floor(Math.random() * MEMORY_SYMBOLS.length)]
  )
}
