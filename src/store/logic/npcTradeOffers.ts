import type { NpcStationEntry, NpcTradeOffer, SaveArchive } from '@/types/saveArchive'
import type { X4Ware } from '@/types/x4'

export type PlayerTradeDirection = 'buy' | 'sell'
export type NpcTradeDemandSource = 'station' | 'supplies' | 'buildStorage'
export type NpcTradeSortMetric = 'quantity' | 'price' | 'fillablePrice' | 'targetTotal'
export type NpcTradeRankMode = 'primary' | 'composite'

export interface WareTarget {
  wareId: string
  targetQty: number | null
}

export interface NpcTradeOfferFact {
  tradeId: string
  wareId: string
  source: NpcTradeDemandSource
  price: number
  amount: number
  desired?: number
}

export interface NpcTradeStationCandidate {
  key: string
  sectorMacro: string
  code: string
  owner: string
  station: NpcStationEntry
  offersByWare: Record<string, NpcTradeOfferFact[]>
}

export interface NpcTradeSectorGroup {
  sectorMacro: string
  stations: NpcTradeStationCandidate[]
}

export interface NpcTradeComparatorOptions {
  direction: PlayerTradeDirection
  rankMode: NpcTradeRankMode
  metric: NpcTradeSortMetric
  targets: WareTarget[]
  primaryWareId: string | null
}

export function calculateContainerWareMaxLoad(
  capacity: number,
  ware: Pick<X4Ware, 'transport' | 'volume'>
): number {
  if (capacity <= 0 || ware.transport !== 'container' || ware.volume <= 0) return 0
  return Math.floor(capacity / ware.volume)
}

function toOfferFact(offer: NpcTradeOffer, source: NpcTradeDemandSource): NpcTradeOfferFact {
  return {
    tradeId: offer.tradeId,
    wareId: offer.ware,
    source,
    price: offer.price,
    amount: offer.amount,
    desired: offer.desired
  }
}

export function getNpcTradeOffers(
  station: NpcStationEntry,
  direction: PlayerTradeDirection,
  wareId: string
): NpcTradeOfferFact[] {
  const result: NpcTradeOfferFact[] = []
  const stationOffers = station.tradeOffers
  if (stationOffers !== undefined) {
    for (const offer of stationOffers) {
      if (offer.ware !== wareId) continue
      if (direction === 'buy') {
        if (offer.side === 'sell') {
          result.push(toOfferFact(offer, 'station'))
        }
        continue
      }
      if (offer.side !== 'buy') continue
      const source = offer.flags.includes('supplies') ? 'supplies' : 'station'
      result.push(toOfferFact(offer, source))
    }
  }

  if (direction === 'sell') {
    const buildOffers = station.buildStorage?.tradeOffers
    if (buildOffers !== undefined) {
      for (const offer of buildOffers) {
        if (offer.ware === wareId && offer.side === 'buy') {
          result.push(toOfferFact(offer, 'buildStorage'))
        }
      }
    }
  }
  return result
}

export function buildNpcTradeCandidates(
  archive: SaveArchive,
  direction: PlayerTradeDirection,
  wareIds: string[]
): NpcTradeStationCandidate[] {
  const candidates: NpcTradeStationCandidate[] = []
  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    const stations = sector.npc_stations
    if (stations === undefined) continue
    for (const station of Object.values(stations)) {
      const offersByWare: Record<string, NpcTradeOfferFact[]> = {}
      for (const wareId of wareIds) {
        const offers = getNpcTradeOffers(station, direction, wareId)
        if (offers.length > 0) offersByWare[wareId] = offers
      }
      if (Object.keys(offersByWare).length === 0) continue
      candidates.push({
        key: `${sectorMacro}:${station.code}`,
        sectorMacro,
        code: station.code,
        owner: station.owner,
        station,
        offersByWare
      })
    }
  }
  return candidates
}

function compareStable(a: NpcTradeStationCandidate, b: NpcTradeStationCandidate): number {
  return a.key.localeCompare(b.key)
}

function compareDescending(a: number, b: number): number {
  if (a > b) return -1
  if (a < b) return 1
  return 0
}

function compareAscending(a: number, b: number): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function maxAmount(offers: NpcTradeOfferFact[]): number {
  let value = offers[0]!.amount
  for (let index = 1; index < offers.length; index += 1) {
    if (offers[index]!.amount > value) value = offers[index]!.amount
  }
  return value
}

function bestPrice(offers: NpcTradeOfferFact[], direction: PlayerTradeDirection): number {
  let value = offers[0]!.price
  for (let index = 1; index < offers.length; index += 1) {
    const price = offers[index]!.price
    if (direction === 'sell' && price > value) value = price
    if (direction === 'buy' && price < value) value = price
  }
  return value
}

function compareSingleWare(
  a: NpcTradeStationCandidate,
  b: NpcTradeStationCandidate,
  direction: PlayerTradeDirection,
  metric: NpcTradeSortMetric,
  target: WareTarget
): number {
  const aOffers = a.offersByWare[target.wareId]
  const bOffers = b.offersByWare[target.wareId]
  if (aOffers === undefined && bOffers !== undefined) return 1
  if (aOffers !== undefined && bOffers === undefined) return -1
  if (aOffers === undefined || bOffers === undefined) return compareStable(a, b)

  if (metric === 'quantity') {
    const result = compareDescending(maxAmount(aOffers), maxAmount(bOffers))
    return result === 0 ? compareStable(a, b) : result
  }
  if (metric === 'price') {
    const aPrice = bestPrice(aOffers, direction)
    const bPrice = bestPrice(bOffers, direction)
    const result = direction === 'sell'
      ? compareDescending(aPrice, bPrice)
      : compareAscending(aPrice, bPrice)
    return result === 0 ? compareStable(a, b) : result
  }

  const targetQty = target.targetQty
  if (targetQty === null || targetQty <= 0) return compareStable(a, b)
  if (metric === 'fillablePrice') {
    const aFillable = aOffers.filter((offer) => offer.amount >= targetQty)
    const bFillable = bOffers.filter((offer) => offer.amount >= targetQty)
    if (aFillable.length === 0 && bFillable.length > 0) return 1
    if (aFillable.length > 0 && bFillable.length === 0) return -1
    if (aFillable.length === 0 || bFillable.length === 0) return compareStable(a, b)
    const aPrice = bestPrice(aFillable, direction)
    const bPrice = bestPrice(bFillable, direction)
    const result = direction === 'sell'
      ? compareDescending(aPrice, bPrice)
      : compareAscending(aPrice, bPrice)
    return result === 0 ? compareStable(a, b) : result
  }

  if (direction === 'sell') {
    const revenue = (offers: NpcTradeOfferFact[]) => {
      let value = 0
      for (const offer of offers) {
        const current = Math.min(offer.amount, targetQty) * offer.price
        if (current > value) value = current
      }
      return value
    }
    const result = compareDescending(revenue(aOffers), revenue(bOffers))
    return result === 0 ? compareStable(a, b) : result
  }

  const aFillable = aOffers.filter((offer) => offer.amount >= targetQty)
  const bFillable = bOffers.filter((offer) => offer.amount >= targetQty)
  if (aFillable.length === 0 && bFillable.length > 0) return 1
  if (aFillable.length > 0 && bFillable.length === 0) return -1
  if (aFillable.length > 0 && bFillable.length > 0) {
    const result = compareAscending(
      targetQty * bestPrice(aFillable, 'buy'),
      targetQty * bestPrice(bFillable, 'buy')
    )
    return result === 0 ? compareStable(a, b) : result
  }
  const amountResult = compareDescending(maxAmount(aOffers), maxAmount(bOffers))
  if (amountResult !== 0) return amountResult
  const priceResult = compareAscending(bestPrice(aOffers, 'buy'), bestPrice(bOffers, 'buy'))
  return priceResult === 0 ? compareStable(a, b) : priceResult
}

interface CompositeScore {
  fulfilledWareCount: number
  averageFillRatio: number
  totalFillableQty: number
  totalAmount: number
}

function compositeScore(
  station: NpcTradeStationCandidate,
  direction: PlayerTradeDirection,
  targets: WareTarget[]
): CompositeScore {
  let fulfilledWareCount = 0
  let fillRatioTotal = 0
  let totalFillableQty = 0
  let totalAmount = 0
  for (const target of targets) {
    const targetQty = target.targetQty
    const offers = station.offersByWare[target.wareId]
    if (targetQty === null || targetQty <= 0 || offers === undefined) continue
    let bestFillableQty = 0
    let bestAmount = 0
    for (const offer of offers) {
      const fillableQty = Math.min(offer.amount, targetQty)
      const amount = fillableQty * offer.price
      if (fillableQty > bestFillableQty) {
        bestFillableQty = fillableQty
        bestAmount = amount
        continue
      }
      if (fillableQty !== bestFillableQty) continue
      if (direction === 'sell' && amount > bestAmount) bestAmount = amount
      if (direction === 'buy' && amount < bestAmount) bestAmount = amount
    }
    const fillRatio = bestFillableQty / targetQty
    if (fillRatio >= 1) fulfilledWareCount += 1
    fillRatioTotal += fillRatio
    totalFillableQty += bestFillableQty
    totalAmount += bestAmount
  }
  return {
    fulfilledWareCount,
    averageFillRatio: targets.length === 0 ? 0 : fillRatioTotal / targets.length,
    totalFillableQty,
    totalAmount
  }
}

export function createNpcTradeStationComparator(
  options: NpcTradeComparatorOptions
): (a: NpcTradeStationCandidate, b: NpcTradeStationCandidate) => number {
  if (options.rankMode === 'primary') {
    const primary = options.targets.find((target) => target.wareId === options.primaryWareId)
    if (primary === undefined) return compareStable
    return (a, b) => compareSingleWare(a, b, options.direction, options.metric, primary)
  }

  return (a, b) => {
    const aScore = compositeScore(a, options.direction, options.targets)
    const bScore = compositeScore(b, options.direction, options.targets)
    let result = compareDescending(aScore.fulfilledWareCount, bScore.fulfilledWareCount)
    if (result !== 0) return result
    result = compareDescending(aScore.averageFillRatio, bScore.averageFillRatio)
    if (result !== 0) return result
    result = compareDescending(aScore.totalFillableQty, bScore.totalFillableQty)
    if (result !== 0) return result
    result = options.direction === 'sell'
      ? compareDescending(aScore.totalAmount, bScore.totalAmount)
      : compareAscending(aScore.totalAmount, bScore.totalAmount)
    return result === 0 ? compareStable(a, b) : result
  }
}

export function groupNpcTradeStations(
  candidates: NpcTradeStationCandidate[],
  comparator: (a: NpcTradeStationCandidate, b: NpcTradeStationCandidate) => number
): NpcTradeSectorGroup[] {
  const bySector = new Map<string, NpcTradeStationCandidate[]>()
  for (const candidate of candidates) {
    const existing = bySector.get(candidate.sectorMacro)
    if (existing === undefined) {
      bySector.set(candidate.sectorMacro, [candidate])
    } else {
      existing.push(candidate)
    }
  }
  const groups = Array.from(bySector, ([sectorMacro, stations]) => ({
    sectorMacro,
    stations: [...stations].sort(comparator)
  }))
  groups.sort((a, b) => comparator(a.stations[0]!, b.stations[0]!))
  return groups
}

export function npcTradeSortNeedsTargets(
  rankMode: NpcTradeRankMode,
  metric: NpcTradeSortMetric,
  targets: WareTarget[],
  primaryWareId: string | null
): boolean {
  if (rankMode === 'composite') {
    return targets.some((target) => target.targetQty === null || target.targetQty <= 0)
  }
  if (metric !== 'fillablePrice' && metric !== 'targetTotal') return false
  const target = targets.find((item) => item.wareId === primaryWareId)
  return target === undefined || target.targetQty === null || target.targetQty <= 0
}
