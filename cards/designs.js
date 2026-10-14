// ============================================================================
// CARD DESIGNS  (every card can have many designs; people swipe through them)
//
// Every card already has one design called "classic" (the one that exists today).
// TO ADD A NEW DESIGN LATER, you only do two things:
//   1. Put the new design page in its own folder, for example
//        cards/proposal-royal/index.html      (same page style as cards/proposal-experience/index.html;
//                                              it receives the same ?to=&from=&msg=&photos=... values)
//   2. Add ONE line for it in `extraDesigns` below.
// It then appears automatically in the swipe slider on the card page, in the Live Demo,
// and as the "Choose a design" step when someone creates a wish. Nothing else to change.
// ============================================================================

// Cards that already have their own full animated page (the first design of these cards).
const OWN_PAGE = ["proposal", "girlfriend", "boyfriend", "miss", "birthday"];

export const extraDesigns = {
  // Example (remove the two slashes to try it once the folder exists):
  // proposal: [{ id: "royal", name: "Royal Gold", path: "cards/proposal-royal/index.html", preview: "cards/proposal-royal/preview.jpg" }],
};

export function designsFor(cardId) {
  const classic = { id: "classic", name: "Classic", path: OWN_PAGE.includes(cardId) ? `cards/${cardId}-experience/index.html` : null, preview: "" };
  return [classic, ...(extraDesigns[cardId] || [])];
}
export const designOf = (cardId, designId) => {
  const list = designsFor(cardId);
  return list.find((d) => d.id === designId) || list[0];
};
