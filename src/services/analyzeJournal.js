export async function analyzeJournal(text) {
  const lowerText = text.toLowerCase();

  const categories = {
    gratitude: ["grateful", "thank", "thanks"],
    kindness: ["helped", "kind", "support"],
    reflection: ["realized", "learned", "noticed"],
    growth: ["improved", "progress", "better"],
  };

  const scores = {};

  for (const [category, words] of Object.entries(categories)) {
    scores[category] = words.some((word) =>
      lowerText.includes(word)
    )
      ? 1
      : 0;
  }

  const water =
    Object.values(scores).some((score) => score > 0)
      ? 1
      : 0;

  return {
    ...scores,
    water,
  };
}