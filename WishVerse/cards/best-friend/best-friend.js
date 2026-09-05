import { cards } from "../index.js";
export const cardId = "best-friend";
export function getCardConfig() { return cards.find(card => card.id === cardId); }
export default getCardConfig;
