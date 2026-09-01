import type { PlayerShipEntry, PlayerShipOrderSummary } from '@/types/saveArchive'

const ECONOMIC_ORDERS = new Set([
  'TradeRoutine',
  'MiningRoutine',
  'SalvageRoutine',
  'Scavenge',
  'ScavengeRoutine',
  'TradePerform',
  'SingleBuy',
  'SingleSell',
  'Middleman'
])

const WAIT_ONLY_ORDERS = new Set([
  'Wait',
  'DockAt',
  'DockAndWait',
  'FlyTo',
  'FlyAndWait',
  'MoveTo',
  'MoveAndWait'
])

export type PlayerShipAssignmentClass = 'station' | 'ship' | 'none' | 'unknown'
export type PlayerShipActivity = 'economic' | 'repeat' | 'waitOnly' | 'idle' | 'unknown'
export type PlayerShipRepeatStatus = 'confirmed' | 'notConfirmed'
export type PlayerShipAvailability = 'unavailable' | 'immediatelyAvailable' | 'reclaimable' | 'unknown'
export type PlayerShipAvailabilityReason =
  | 'stationAssignment'
  | 'shipAssignment'
  | 'economicOrder'
  | 'repeatOrder'
  | 'idleWait'
  | 'waitOnlyOrder'
  | 'unresolvedAssignment'
  | 'missingOrderFacts'
  | 'unknownOrder'

export interface PlayerShipAvailabilityState {
  componentId: string
  code: string
  name?: string
  macro: string
  class: string
  sectorMacro: string
  assignment: PlayerShipAssignmentClass
  activity: PlayerShipActivity
  repeatStatus: PlayerShipRepeatStatus
  availability: PlayerShipAvailability
  reason: PlayerShipAvailabilityReason
}

function hasEconomicOrder(order: PlayerShipOrderSummary | undefined): boolean {
  return order !== undefined && ECONOMIC_ORDERS.has(order.order)
}

function classifyAssignment(ship: PlayerShipEntry): PlayerShipAssignmentClass {
  if (ship.assignment.state === 'none') return 'none'
  if (ship.assignment.state === 'unresolved') return 'unknown'
  if (ship.assignment.commander_kind === 'station') return 'station'
  if (ship.assignment.commander_kind === 'ship') return 'ship'
  return 'unknown'
}

function classifyActivity(ship: PlayerShipEntry): PlayerShipActivity {
  const orders = ship.orders === undefined ? [] : ship.orders
  if (hasEconomicOrder(ship.default_order) || orders.some(hasEconomicOrder)) return 'economic'
  if (ship.is_repeat) return 'repeat'
  if (ship.default_order === undefined) return 'unknown'
  if (ship.default_order.order !== 'Wait') return 'unknown'
  if (orders.length === 0) return 'idle'
  if (orders.every((order) => WAIT_ONLY_ORDERS.has(order.order))) return 'waitOnly'
  return 'unknown'
}

export function classifyPlayerShip(
  ship: PlayerShipEntry,
  sectorMacro: string
): PlayerShipAvailabilityState {
  const assignment = classifyAssignment(ship)
  const activity = classifyActivity(ship)
  const repeatStatus: PlayerShipRepeatStatus = ship.is_repeat ? 'confirmed' : 'notConfirmed'

  let availability: PlayerShipAvailability
  let reason: PlayerShipAvailabilityReason
  if (assignment === 'station') {
    availability = 'unavailable'
    reason = 'stationAssignment'
  } else if (assignment === 'ship') {
    availability = 'unavailable'
    reason = 'shipAssignment'
  } else if (assignment === 'unknown') {
    availability = 'unknown'
    reason = 'unresolvedAssignment'
  } else if (activity === 'economic') {
    availability = 'unavailable'
    reason = 'economicOrder'
  } else if (activity === 'repeat') {
    availability = 'unavailable'
    reason = 'repeatOrder'
  } else if (activity === 'idle') {
    availability = 'immediatelyAvailable'
    reason = 'idleWait'
  } else if (activity === 'waitOnly') {
    availability = 'reclaimable'
    reason = 'waitOnlyOrder'
  } else if (ship.default_order === undefined) {
    availability = 'unknown'
    reason = 'missingOrderFacts'
  } else {
    availability = 'unknown'
    reason = 'unknownOrder'
  }

  return {
    componentId: ship.component_id,
    code: ship.code,
    name: ship.name,
    macro: ship.macro,
    class: ship.class,
    sectorMacro,
    assignment,
    activity,
    repeatStatus,
    availability,
    reason
  }
}
