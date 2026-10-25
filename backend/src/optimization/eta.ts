export function predictDelayMinutes(position: number): number {
  return 5 * Math.max(0, position - 1);
}

export function etaWindow(
  planned: Date,
  position: number,
  before = 15,
  after = 45,
): [Date, Date] {
  const delay = predictDelayMinutes(position);
  return [
    new Date(planned.getTime() - before * 60_000),
    new Date(planned.getTime() + (after + delay) * 60_000),
  ];
}
