const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/><path d="M2 10 12 2l10 8"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  settings:
    '<path d="M10.25 2.8h3.5l.62 2.12a7.25 7.25 0 0 1 1.55.9l2.12-.68 1.75 3.03-1.52 1.58a7.1 7.1 0 0 1 0 1.8l1.52 1.58-1.75 3.03-2.12-.68a7.25 7.25 0 0 1-1.55.9l-.62 2.12h-3.5l-.62-2.12a7.25 7.25 0 0 1-1.55-.9l-2.12.68-1.75-3.03 1.52-1.58a7.1 7.1 0 0 1 0-1.8L4.21 8.17l1.75-3.03 2.12.68a7.25 7.25 0 0 1 1.55-.9l.62-2.12Z"/><circle cx="12" cy="11.23" r="2.65"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="11" cy="6.8" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  "calendar-days":
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2m4 0h2m-8 4h2"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3M2 12h16a3 3 0 1 1-3 3M4 16h6"/>',
  "git-compare-arrows":
    '<path d="M16 3l4 4-4 4M20 7H8a4 4 0 0 0-4 4m4 10-4-4 4-4m-4 4h12a4 4 0 0 0 4-4"/>',
  "chart-no-axes-combined":
    '<path d="M3 3v18h18M7 14l4-4 4 3 6-7"/><path d="M17 6h4v4"/>',
  "trending-up": '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  "trending-down": '<path d="m3 7 6 6 4-4 8 9"/><path d="M15 18h6v-6"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  waves:
    '<path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  "calendar-check":
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m4 9 2 2 4-4"/>',
  heart:
    '<path d="M20.8 8.8c0 5.2-8.8 11-8.8 11S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/>',
  images:
    '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="m3 13 4-4 3 3 2-2 5 5M18 7h3v14H7v-3"/>',
  "sliders-horizontal":
    '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 7h4"/>',
  sparkles:
    '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16ZM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6L5 2Z"/>',
  "arrow-up-right": '<path d="M7 17 17 7M7 7h10v10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  x: '<path d="m18 6-12 12M6 6l12 12"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  crosshair:
    '<circle cx="12" cy="12" r="8"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  "settings-2": '<path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6"/>',
  "map-pin":
    '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.8-2L20 12M4 12l2.7 5a7 7 0 0 0 11.8-2"/>',
  thermometer:
    '<path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 12v6"/>',
  droplet:
    '<path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z"/>',
  gauge:
    '<path d="M12 14l4-4M4.9 19a9 9 0 1 1 14.2 0M7 19h10"/><circle cx="12" cy="14" r="1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/>',
  cloud:
    '<path d="M20 16.2A4.8 4.8 0 0 0 18.5 7a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 18h12"/>',
  "cloud-rain":
    '<path d="M20 15.5A4.5 4.5 0 0 0 18.5 7a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 18h12M8 20l-1 2m6-2-1 2m6-2-1 2"/>',
  "cloud-sun":
    '<path d="M12 2v2m-7 1 1.4 1.4M2 12h2m8 0h2m-1.6-6.6L14 4M8 15.5A4.5 4.5 0 0 1 12.5 11a4.5 4.5 0 0 1 4.3 3.2A4 4 0 0 1 18 22H7a4 4 0 0 1 1-6.5Z"/>',
  "cloud-lightning":
    '<path d="M20 15.5A4.5 4.5 0 0 0 18.5 7a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 18h6l-2 4 6-7h-4l2-3"/>',
  "cloud-snow":
    '<path d="M20 15.5A4.5 4.5 0 0 0 18.5 7a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 18h12M8 21h.01M12 22h.01M16 21h.01"/>',
  compass:
    '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.8 6.4-6.4 2.8 2.8-6.4 6.4-2.8Z"/>',
  sunrise:
    '<path d="M12 2v7m-4-3 4 4 4-4M4 18a8 8 0 0 1 16 0M2 22h20M4 18h16"/>',
  sunset:
    '<path d="M12 10V3m-4 4 4-4 4 4M4 18a8 8 0 0 1 16 0M2 22h20M4 18h16"/>',
  "cloud-fog":
    '<path d="M20 12.5A4.5 4.5 0 0 0 18.5 4a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 15h12M3 19h18M6 22h12"/>',
  "arrow-up": '<path d="m5 12 7-7 7 7M12 19V5"/>',
  "arrow-down": '<path d="m5 12 7 7 7-7M12 5v14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>',
  share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:
    '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>',
  "cloud-sun-rain":
    '<path d="M12 2v2m-7 1 1.4 1.4M2 12h2m8 0h2m-1.6-6.6L14 4M8 15.5A4.5 4.5 0 0 1 12.5 11a4.5 4.5 0 0 1 4.3 3.2A4 4 0 0 1 18 22H7a4 4 0 0 1 1-6.5ZM9 20l-1 2m6-2-1 2"/>',
  "cloud-drizzle":
    '<path d="M20 15.5A4.5 4.5 0 0 0 18.5 7a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 18h12M8 20v.01m4 1v.01m4-1v.01"/>',
  "arrow-left": '<path d="m12 19-7-7 7-7M5 12h14"/>',
  "arrow-right": '<path d="m12 5 7 7-7 7M19 12H5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>',
  alert:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  "cloud-upload":
    '<path d="M12 16V8m-4 4 4-4 4 4M20 16.5A4.5 4.5 0 0 0 18.5 8a7 7 0 0 0-13.2 2.2A4.5 4.5 0 0 0 6 19h12"/>',
  "list-checks": '<path d="m3 6 2 2 4-4m4 2h8M3 16l2 2 4-4m4 2h8"/>',
  "panel-left":
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  leaf: '<path d="M20 4c-8 0-14 4-14 11a5 5 0 0 0 5 5c7 0 11-6 9-16ZM4 21c3-5 7-8 12-11"/>',
  thermometer_sun:
    '<path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 12v6m8-16v2m-3 1 1 1m4-1-1 1m-1 2h2"/>',
  "file-text":
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
  "cloud-off":
    '<path d="m2 2 20 20M8.5 8.2A7 7 0 0 1 18.5 12a4.5 4.5 0 0 1 1.1 8.6M5 9.2A4.5 4.5 0 0 0 6 18h6"/>',
  "radio-tower":
    '<path d="M12 3v18m-4-2 4-16 4 16M6 7a9 9 0 0 0 0 10m12-10a9 9 0 0 1 0 10M3 4a13 13 0 0 0 0 16m18-16a13 13 0 0 1 0 16"/>',
  "sun-medium":
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  "calendar-clock":
    '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18m9 4v4l2 1"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  layers:
    '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  "book-open":
    '<path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H12v19H4.5A2.5 2.5 0 0 0 2 23V4.5Zm20 0A2.5 2.5 0 0 0 19.5 2H12v19h7.5A2.5 2.5 0 0 1 22 23V4.5Z"/>',
  "shield-check":
    '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
};

export function icon(name, className = "") {
  const content = paths[name] || paths.info;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.getAttribute("data-icon");
    node.innerHTML = icon(name);
  });
}
