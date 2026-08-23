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

  const countCategoryScores = (source) => {
    const scores = {};
    for (const [category, words] of Object.entries(categories)) {
      const matchCount = words.reduce((count, word) => {
        return keywordMatched(source, word) ? count + 1 : count;
      }, 0);
      scores[category] = matchCount >= 2 ? 2 : matchCount >= 1 ? 1 : 0;
    }
    return scores;
  };

  const detectSafetyConcern = (source) => {
    // High-confidence gate: detect only explicit, immediate self-harm or severe violence intent.
    const selfTarget = "(?:\\bi\\b|\\bi'm\\b|\\bi am\\b|\\bmyself\\b)";
    const otherTarget = "(?:him|her|them|someone|people|person|my boss|my friend|my family)";
    const imminent = "(?:now|right now|today|tonight|immediately|soon)";
    const severeSelfHarmAction = "(?:kill myself|end my life|suicide|take my own life|hurt myself badly)";
    const severeViolentAction = "(?:kill|murder|shoot|stab)";

    const immediateSelfHarmRegexes = [
      new RegExp(`${selfTarget}.{0,30}\\b(?:want to|going to|plan to|will)\\b.{0,20}\\b${severeSelfHarmAction}\\b`, "i"),
      new RegExp(`\\b${severeSelfHarmAction}\\b.{0,20}\\b${imminent}\\b`, "i"),
      /\b(?:suicide plan|plan for suicide)\b/i,
      /\b(?:kill myself tonight|kill myself now|end my life tonight|end my life now)\b/i,
    ];

    const immediateViolenceRegexes = [
      new RegExp(`${selfTarget}.{0,30}\\b(?:want to|going to|plan to|will)\\b.{0,20}\\b${severeViolentAction}\\b.{0,24}\\b${otherTarget}\\b(?:.{0,20}\\b${imminent}\\b)?`, "i"),
      new RegExp(`${selfTarget}.{0,30}\\b(?:want to|going to|plan to|will)\\b.{0,20}\\b${severeViolentAction}\\b.{0,20}\\b${imminent}\\b.{0,24}\\b${otherTarget}\\b`, "i"),
      new RegExp(`\\b${severeViolentAction}\\b.{0,20}\\b${otherTarget}\\b.{0,20}\\b${imminent}\\b`, "i"),
      /\b(?:i will hurt someone seriously)\b/i,
    ];

    const japaneseHighRiskPhrases = [
      "今すぐ自殺する",
      "今夜自殺する",
      "死ぬ計画",
      "自殺する計画",
      "今すぐ殺してやる",
      "今夜殺してやる",
      "刺してやる",
    ];

    const hasImmediateSelfHarm = immediateSelfHarmRegexes.some((regex) => regex.test(source));
    const hasImmediateViolence = immediateViolenceRegexes.some((regex) => regex.test(source));
    const hasJapaneseHighRiskPhrase = japaneseHighRiskPhrases.some((phrase) => source.includes(phrase));

    return hasImmediateSelfHarm || hasImmediateViolence || hasJapaneseHighRiskPhrase;
  };

  const calculateWaterReward = ({ safetyConcern }) => (safetyConcern ? 0 : 1);

  const scores = countCategoryScores(normalizedText);
  const safetyConcern = detectSafetyConcern(normalizedText);
  const water = calculateWaterReward({
    safetyConcern,
  });

  return res.status(200).json({
    ...scores,
    safetyConcern,
    water,
  });
}