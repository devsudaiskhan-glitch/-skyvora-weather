import { readJSON, writeJSON } from "./storage.js";

let notifiedKeys = new Set(readJSON("notified-rules", []));

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export async function evaluateAlertRules(current, location) {
  const rules = readJSON("alert-rules", []);
  if (!Array.isArray(rules) || !rules.length || !current) return [];
  const hits = [];
  const nowKey = new Date().toISOString().slice(0, 13);
  rules
    .filter((rule) => rule.enabled)
    .forEach((rule) => {
      let matched = false;
      let message = "";
      if (
        rule.type === "rain" &&
        Number.isFinite(current.precipitation_probability) &&
        current.precipitation_probability >= Number(rule.threshold)
      ) {
        matched = true;
        message = `Rain probability is ${Math.round(current.precipitation_probability)}%.`;
      }
      if (
        rule.type === "heat" &&
        Number.isFinite(current.temperature_2m) &&
        current.temperature_2m >= Number(rule.threshold)
      ) {
        matched = true;
        message = `Temperature has reached ${Math.round(current.temperature_2m)}°C.`;
      }
      if (
        rule.type === "wind" &&
        Number.isFinite(current.wind_speed_10m) &&
        current.wind_speed_10m >= Number(rule.threshold)
      ) {
        matched = true;
        message = `Wind speed is ${Math.round(current.wind_speed_10m)} km/h.`;
      }
      const key = `${rule.id}:${nowKey}`;
      if (matched && !notifiedKeys.has(key)) {
        hits.push({
          title: rule.label || "Weather threshold reached",
          message,
        });
        notifiedKeys.add(key);
      }
    });
  notifiedKeys = new Set([...notifiedKeys].slice(-100));
  writeJSON("notified-rules", [...notifiedKeys]);
  if (
    hits.length &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    hits.forEach(
      (hit) =>
        new Notification(`Skyvora · ${location.name}`, {
          body: `${hit.title}: ${hit.message}`,
          icon: "/assets/icons/skyvora-app-icon-192.png",
        }),
    );
  }
  return hits;
}
