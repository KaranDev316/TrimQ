const FALLBACK_AVERAGE_MINUTES = 55;

export function estimateWaitMinutes(peopleAhead) {
  return peopleAhead * FALLBACK_AVERAGE_MINUTES;
}
