import Decimal from "decimal.js-light";
import { CraftableName, CRAFTABLES, FOODS, TOOLS } from "../types/craftables";
import { SEEDS } from "../types/crops";
import { GameState, InventoryItemName } from "../types/game";

export type CraftAction = {
  type: "item.crafted";
  item: InventoryItemName;
  amount: number;
  valid?: CraftableName[];
};

/**
 * Only tools, seeds and food can be crafted through the craft function
 * NFTs are not crafted through this function, they are a direct call to the Polygon Blockchain
 */
const VALID_ITEMS = Object.keys({
  ...TOOLS,
  ...SEEDS,
  ...FOODS,
}) as CraftableName[];

function isCraftable(
  item: InventoryItemName,
  names: CraftableName[]
): item is CraftableName {
  return (item as CraftableName) in names;
}

type Options = {
  state: GameState;
  action: CraftAction;
};

export function craft({ state, action }: Options) {
  if (!isCraftable(action.item, action.valid || VALID_ITEMS)) {
    throw new Error(`This item is not craftable: ${action.item}`);
  }

  const item = CRAFTABLES[action.item];

  if (item.disabled) {
    throw new Error("This item is disabled");
  }

  if (action.amount !== 1 && action.amount !== 10) {
    throw new Error("Invalid amount");
  }

  const totalExpenses = item.price * action.amount;

  const isLocked = item.requires && !state.inventory[item.requires];
  if (isLocked) {
    throw new Error(`Missing ${item.requires}`);
  }

  if (state.balance.lessThan(totalExpenses)) {
    throw new Error("Insufficient tokens");
  }

  const subtractedInventory = item.ingredients.reduce(
    (inventory, ingredient) => {
      const count = inventory[ingredient.item] || new Decimal(0);
      const totalAmount = ingredient.amount * action.amount;

      if (count.lessThan(totalAmount)) {
        throw new Error(`Insufficient ingredient: ${ingredient.item}`);
      }

      return {
        ...inventory,
        [ingredient.item]: count.sub(totalAmount),
      };
    },
    state.inventory
  );

  const oldAmount = state.inventory[action.item] || new Decimal(0);

  return {
    ...state,
    balance: state.balance.sub(totalExpenses),
    inventory: {
      ...subtractedInventory,
      [action.item]: oldAmount.add(action.amount),
    },
  };
}
