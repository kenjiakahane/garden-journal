export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({
      error: "Text is required",
    });
  }

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

  const matchedCount = Object.values(scores).filter(
    (score) => score > 0
  ).length;

  const water =
    matchedCount >= 3 ? 2 :
    matchedCount >= 1 ? 1 :
    0;

  return res.status(200).json({
    ...scores,
    water,
  });
}