const formatterCache = new Map();

function formatter(timezone) {
  if (!formatterCache.has(timezone)) {
    formatterCache.set(
      timezone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    );
  }
  return formatterCache.get(timezone);
}

export function validTimezone(value) {
  if (value !== "UTC" && !String(value || "").includes("/")) return false;
  try {
    formatter(value || "UTC").format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function localParts(at = new Date(), timezone = "UTC") {
  const parts = Object.fromEntries(
    formatter(timezone)
      .formatToParts(at)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function timezoneOffsetMilliseconds(at, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(at);
  const name = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return (match[1] === "-" ? -minutes : minutes) * 60 * 1000;
}

function localMidnightUtc(dateKey, timezone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const estimate = new Date(Date.UTC(year, month - 1, day));
  return new Date(estimate.getTime() - timezoneOffsetMilliseconds(estimate, timezone));
}

export function localDayBounds(at = new Date(), timezone = "UTC") {
  const { dateKey } = localParts(at, timezone);
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextKey = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  return {
    dateKey,
    start: localMidnightUtc(dateKey, timezone),
    end: localMidnightUtc(nextKey, timezone),
  };
}

export function timeInRange(time, start, end) {
  if (start === end) return false;
  return start < end
    ? time >= start && time < end
    : time >= start || time < end;
}
