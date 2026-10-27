export function summarizeTrainingRequestAreas(participants: readonly { trainingArea: string | null }[]) {
  const areas = new Map<string, string>();
  for (const participant of participants) {
    const area = participant.trainingArea?.trim();
    if (area) areas.set(area.toLowerCase(), area);
  }
  if (areas.size === 0) return "Not provided";
  if (areas.size > 1) return "Mixed";
  return areas.values().next().value ?? "Not provided";
}
