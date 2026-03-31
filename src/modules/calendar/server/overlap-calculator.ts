type TimeWindow = {
  start: Date;
  end: Date;
};

export function getOverlapMinutes(a: TimeWindow, b: TimeWindow): number {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());
  if (end <= start) return 0;
  return Math.floor((end - start) / 60000);
}

export function classifyOverlap(params: {
  scheduleWindows: TimeWindow[];
  eventWindow: TimeWindow;
}): { overlapMinutes: number; overlapPercent: number; severity: "full" | "partial" | "none" } {
  const totalEventMinutes = Math.max(1, Math.floor((params.eventWindow.end.getTime() - params.eventWindow.start.getTime()) / 60000));
  const overlapMinutesRaw = params.scheduleWindows.reduce((sum, slot) => {
    return sum + getOverlapMinutes(slot, params.eventWindow);
  }, 0);

  const overlapMinutes = Math.min(overlapMinutesRaw, totalEventMinutes);
  const overlapPercent = (overlapMinutes / totalEventMinutes) * 100;

  if (overlapPercent >= 80) {
    return { overlapMinutes, overlapPercent, severity: "full" };
  }

  if (overlapMinutes > 0) {
    return { overlapMinutes, overlapPercent, severity: "partial" };
  }

  return { overlapMinutes, overlapPercent, severity: "none" };
}
