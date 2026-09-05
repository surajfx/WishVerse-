import { cards } from "../index.js";
export const cardId = "love-letter";
export function getCardConfig() { return cards.find(card => card.id === cardId); }
export default getCardConfig;
