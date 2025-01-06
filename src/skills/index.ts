// Base utilities
export { log } from './base'
export type { BlockFace, Position } from './base'

// Block interaction functions
export {
  activateNearestBlock,
  breakBlockAt,
  placeBlock,
  tillAndSow,
  useDoor,
} from './blocks.js'

// Combat related functions
export {
  attackEntity,
  attackNearest,
  defendSelf,
} from './combat.js'

// Crafting and smelting functions
export {
  clearNearestFurnace,
  craftRecipe,
  smeltItem,
} from './crafting.js'

// Inventory management functions
export {
  consume,
  discard,
  equip,
  giveToPlayer,
  pickupNearbyItems,
  putInChest,
  takeFromChest,
  viewChest,
} from './inventory.js'

// Movement related functions
export {
  followPlayer,
  goToNearestBlock,
  goToNearestEntity,
  goToPlayer,
  goToPosition,
  moveAway,
  moveAwayFromEntity,
  stay,
} from './movement.js'
