export async function analyzeJournal(text) {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Journal analysis failed:", error);

    return {
      gratitude: 0,
      kindness: 0,
      reflection: 0,
      growth: 0,
      water: 0,
      error: true,
    };
  }
}