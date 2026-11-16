/**
 * Role distribution.
 *
 * Given a player count and a role configuration, decide how many of each role
 * to assign, then shuffle them out to players.
 */

import type { Role, RoleConfig, RoundPlayer, UcPlayer, UcPlayerId } from './types'

// ---------------------------------------------------------------------------
// Auto distribution
//
// The goal: enough civilians that the game is not over in one round, but
// enough infiltrators that they have a fighting chance. These numbers are
// close to what the official Undercover app suggests.
// ---------------------------------------------------------------------------

export interface RoleCounts {
  readonly civilians: number
  readonly undercovers: number
  readonly mrWhites: number
}

/**
 * Suggest role counts given the number of players and which roles are enabled.
 *
 * At least one infiltrator type must be enabled.
 */
export function autoDistribute(
  playerCount: number,
  useUndercover: boolean,
  useMrWhite: boolean,
): RoleCounts {
  if (!useUndercover && !useMrWhite) {
    throw new Error('At least one infiltrator role must be enabled')
  }

  let undercovers = 0
  let mrWhites = 0

  if (useUndercover && useMrWhite) {
    // Both enabled
    if (playerCount <= 5) {
      undercovers = 1
      mrWhites = 1
    } else if (playerCount <= 8) {
      undercovers = 1
      mrWhites = 1
    } else if (playerCount <= 12) {
      undercovers = 2
      mrWhites = 1
    } else if (playerCount <= 16) {
      undercovers = 2
      mrWhites = 2
    } else {
      undercovers = 3
      mrWhites = 2
    }
    // 5 players is the minimum for both roles (3 civs + 1 uc + 1 mw).
    // 4 players would give 2 vs 2, which breaks the majority requirement.
  } else if (useUndercover) {
    // Undercover only
    if (playerCount <= 4) {
      undercovers = 1
    } else if (playerCount <= 7) {
      undercovers = 1
    } else if (playerCount <= 10) {
      undercovers = 2
    } else if (playerCount <= 14) {
      undercovers = 3
    } else {
      undercovers = 4
    }
  } else {
    // Mr. White only
    if (playerCount <= 5) {
      mrWhites = 1
    } else if (playerCount <= 9) {
      mrWhites = 1
    } else if (playerCount <= 14) {
      mrWhites = 2
    } else {
      mrWhites = 3
    }
  }

  const civilians = playerCount - undercovers - mrWhites
  return { civilians, undercovers, mrWhites }
}

/**
 * Build a RoleCounts from a manual config, validating the numbers.
 */
export function manualDistribute(playerCount: number, config: RoleConfig): RoleCounts {
  const undercovers = config.useUndercover ? config.undercoverCount : 0
  const mrWhites = config.useMrWhite ? config.mrWhiteCount : 0
  const civilians = playerCount - undercovers - mrWhites

  return { civilians, undercovers, mrWhites }
}

/**
 * Validate that a role distribution makes sense.
 * Returns null if valid, or an error message.
 */
export function validateDistribution(
  playerCount: number,
  counts: RoleCounts,
): string | null {
  const total = counts.civilians + counts.undercovers + counts.mrWhites
  if (total !== playerCount) {
    return `Roles add up to ${total} but there are ${playerCount} players`
  }
  if (counts.civilians < 1) {
    return 'There must be at least one civilian'
  }
  if (counts.undercovers + counts.mrWhites < 1) {
    return 'There must be at least one infiltrator'
  }
  if (counts.undercovers < 0 || counts.mrWhites < 0) {
    return 'Role counts cannot be negative'
  }
  // Civilians should outnumber infiltrators for the game to be fun
  if (counts.civilians <= counts.undercovers + counts.mrWhites) {
    return 'Civilians must outnumber infiltrators'
  }
  return null
}

// ---------------------------------------------------------------------------
// Shuffle and assign
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle. Returns a new array.
 */
function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]!
    result[i] = result[j]!
    result[j] = temp
  }
  return result
}

/**
 * Assign roles to players for one round.
 *
 * Returns RoundPlayers in the same order as the input players, with roles
 * randomly distributed according to the given counts, and words assigned.
 */
export function assignRoles(
  players: readonly UcPlayer[],
  counts: RoleCounts,
  civilianWord: string,
  undercoverWord: string,
): readonly RoundPlayer[] {
  // Build a bag of roles and shuffle it
  const roles: Role[] = [
    ...Array<Role>(counts.civilians).fill('civilian'),
    ...Array<Role>(counts.undercovers).fill('undercover'),
    ...Array<Role>(counts.mrWhites).fill('mrWhite'),
  ]
  const shuffled = shuffle(roles)

  return players.map((player, i) => {
    const role = shuffled[i]!
    let word: string | null
    switch (role) {
      case 'civilian':
        word = civilianWord
        break
      case 'undercover':
        word = undercoverWord
        break
      case 'mrWhite':
        word = null
        break
    }
    return {
      id: player.id,
      role,
      word,
      alive: true,
    }
  })
}

/**
 * Build the description turn order: alive players in a random order.
 */
export function buildTurnOrder(roundPlayers: readonly RoundPlayer[]): readonly UcPlayerId[] {
  const alive = roundPlayers.filter((p) => p.alive)
  return shuffle(alive).map((p) => p.id)
}

/**
 * Minimum players for a given role config.
 */
export function minimumPlayers(config: RoleConfig): number {
  // Need at least 1 civilian + at least 1 infiltrator, so minimum 3
  if (config.useUndercover && config.useMrWhite) return 5
  return 3
}
