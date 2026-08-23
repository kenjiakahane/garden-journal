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

  const normalizedText = text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

  const categories = {
    gratitude: [
      "grateful", "gratitude", "thank", "thanks", "thankful", "appreciate",
      "ありがとう", "感謝", "ありがたい",
    ],
    kindness: [
      "help", "helped", "support", "supported", "kind", "cared",
      "手伝", "助け", "支え", "親切", "優しい",
    ],
    reflection: [
      "realized", "learned", "noticed", "reflect", "understood", "looking back",
      "気づ", "学ん", "振り返", "考え", "思った",
    ],
    growth: [
      "improved", "progress", "better", "growth", "grew", "challenge",
      "成長", "改善", "前進", "挑戦", "できるよう",
    ],
  };

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isAsciiPhrase = (keyword) => /^[a-z\s]+$/.test(keyword);

  const keywordMatched = (source, keyword) => {
    if (isAsciiPhrase(keyword)) {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
      return regex.test(source);
    }
    return source.includes(keyword);
  };

  const scores = {};

  for (const [category, words] of Object.entries(categories)) {
    const matchCount = words.reduce((count, word) => {
      return keywordMatched(normalizedText, word) ? count + 1 : count;
    }, 0);

    scores[category] = matchCount >= 2 ? 2 : matchCount >= 1 ? 1 : 0;
  }

  const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);

  const water =
    totalScore >= 4 ? 2 :
    totalScore >= 1 ? 1 :
    0;

  return res.status(200).json({
    ...scores,
    water,
  });
}