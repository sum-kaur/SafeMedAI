export function normaliseRecommendationText(text, isPractitioner = false) {
  if (!isPractitioner || !text) return text;

  const replacements = new Map([
    ['Please book a GP appointment as soon as possible (within 2 days)', 'Arrange urgent clinician review within 48 hours'],
    ['Book a GP appointment within the next 1-2 weeks', 'Arrange primary care medication review within 1-2 weeks'],
    ['Attend your scheduled follow-up GP appointment', 'Continue with the planned follow-up review'],
    ['GP medication review recommended within 1-2 weeks', 'Primary care medication review recommended within 1-2 weeks'],
    ['Routine medication review at next GP visit', 'Routine medication review at the next planned clinical follow-up'],
  ]);

  return replacements.get(text) || text;
}

export function normaliseRecommendations(recommendations = [], isPractitioner = false) {
  return recommendations.map((recommendation) => ({
    ...recommendation,
    text: normaliseRecommendationText(recommendation.text, isPractitioner),
  }));
}
