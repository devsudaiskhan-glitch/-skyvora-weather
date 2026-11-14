/** Return a bounded forecast window beginning at the hour nearest the selected location's current time. */
export function selectTimeWindow(
  times = [],
  values = [],
  currentTime = null,
  count = 24,
) {
  if (
    !Array.isArray(times) ||
    !Array.isArray(values) ||
    !times.length ||
    !Number.isFinite(count) ||
    count < 1
  ) {
    return { startIndex: 0, rows: [] };
  }
  const target = Date.parse(currentTime || "");
  let startIndex = 0;
  if (Number.isFinite(target)) {
    let bestDistance = Infinity;
    times.forEach((time, index) => {
      const stamp = Date.parse(time);
      if (!Number.isFinite(stamp)) return;
      const distance = Math.abs(stamp - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        startIndex = index;
      }
    });
  }
  const end = Math.min(times.length, startIndex + Math.floor(count));
  const rows = times.slice(startIndex, end).map((time, offset) => ({
    time,
    value: Number.isFinite(values[startIndex + offset])
      ? values[startIndex + offset]
      : null,
  }));
  return { startIndex, rows };
}

/** Average a real hourly Open-Meteo series for one provider-local calendar date. */
export function averageHourlyByDate(hourly = {}, date, field) {
  if (
    !date ||
    !field ||
    !Array.isArray(hourly.time) ||
    !Array.isArray(hourly[field])
  )
    return null;
  let total = 0;
  let count = 0;
  for (let index = 0; index < hourly.time.length; index += 1) {
    if (String(hourly.time[index]).slice(0, 10) !== date) continue;
    const value = hourly[field][index];
    if (!Number.isFinite(value)) continue;
    total += value;
    count += 1;
  }
  return count ? total / count : null;
}
