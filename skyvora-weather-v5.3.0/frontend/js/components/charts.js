const NS = "http://www.w3.org/2000/svg";
const number = (value) => (Number.isFinite(value) ? value : null);

function svgElement(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) =>
    el.setAttribute(key, String(value)),
  );
  return el;
}

export function renderLineChart(
  container,
  points,
  {
    unit = "",
    color = "#85d7f5",
    fill = true,
    height = 190,
    valueFormatter = (v) => `${Math.round(v)}${unit}`,
    id = "skyvora-chart",
  } = {},
) {
  if (!container) return;
  const clean = points.filter((point) => number(point.value) !== null);
  container.innerHTML = "";
  if (clean.length < 2) {
    container.innerHTML =
      '<div class="empty-chart">Not enough data to draw this chart.</div>';
    return;
  }
  const width = 760;
  const pad = { top: 18, right: 18, bottom: 31, left: 36 };
  const minRaw = Math.min(...clean.map((point) => point.value));
  const maxRaw = Math.max(...clean.map((point) => point.value));
  const spread = Math.max(1, maxRaw - minRaw);
  const min = minRaw - spread * 0.17;
  const max = maxRaw + spread * 0.17;
  const x = (index) =>
    pad.left + (index / (clean.length - 1)) * (width - pad.left - pad.right);
  const y = (value) =>
    pad.top + ((max - value) / (max - min)) * (height - pad.top - pad.bottom);
  const values = clean.map((point, index) => [x(index), y(point.value)]);
  const linePath = values
    .map(
      ([px, py], index) =>
        `${index ? "L" : "M"} ${px.toFixed(2)} ${py.toFixed(2)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L ${values.at(-1)[0]} ${height - pad.bottom} L ${values[0][0]} ${height - pad.bottom} Z`;
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `Weather chart with ${clean.length} data points`,
  });
  const defs = svgElement("defs");
  const gradient = svgElement("linearGradient", {
    id: `${id}-gradient`,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1",
  });
  gradient.append(
    svgElement("stop", {
      offset: "0%",
      "stop-color": color,
      "stop-opacity": ".23",
    }),
  );
  gradient.append(
    svgElement("stop", {
      offset: "100%",
      "stop-color": color,
      "stop-opacity": "0",
    }),
  );
  defs.append(gradient);
  svg.append(defs);

  for (let i = 0; i < 4; i += 1) {
    const gy = pad.top + (i / 3) * (height - pad.top - pad.bottom);
    svg.append(
      svgElement("line", {
        x1: pad.left,
        y1: gy,
        x2: width - pad.right,
        y2: gy,
        stroke: "currentColor",
        "stroke-opacity": ".09",
        "stroke-dasharray": "3 6",
      }),
    );
    const value = max - (i / 3) * (max - min);
    const label = svgElement("text", {
      x: 0,
      y: gy + 3,
      fill: "currentColor",
      "fill-opacity": ".48",
      "font-size": "9",
      "font-family": "DM Sans, sans-serif",
    });
    label.textContent = Math.round(value);
    svg.append(label);
  }
  if (fill)
    svg.append(
      svgElement("path", { d: areaPath, fill: `url(#${id}-gradient)` }),
    );
  svg.append(
    svgElement("path", {
      d: linePath,
      fill: "none",
      stroke: color,
      "stroke-width": "2.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );

  clean.forEach((point, index) => {
    const [px, py] = values[index];
    const group = svgElement("g", {
      class: "chart-point",
      tabindex: "0",
      role: "img",
      "aria-label": `${point.label}: ${valueFormatter(point.value)}`,
    });
    group.append(
      svgElement("circle", {
        cx: px,
        cy: py,
        r: "10",
        fill: color,
        "fill-opacity": ".001",
      }),
    );
    group.append(
      svgElement("circle", {
        cx: px,
        cy: py,
        r: index % Math.ceil(clean.length / 7) === 0 ? "3.4" : "2.1",
        fill: color,
        stroke: "var(--surface)",
        "stroke-width": "1.4",
      }),
    );
    const title = svgElement("title");
    title.textContent = `${point.label}: ${valueFormatter(point.value)}`;
    group.append(title);
    svg.append(group);
    if (
      index % Math.ceil(clean.length / 7) === 0 ||
      index === clean.length - 1
    ) {
      const label = svgElement("text", {
        x: px,
        y: height - 8,
        fill: "currentColor",
        "fill-opacity": ".55",
        "font-size": "9",
        "text-anchor": "middle",
        "font-family": "DM Sans, sans-serif",
      });
      label.textContent = point.label;
      svg.append(label);
    }
  });
  container.append(svg);
}

export function renderBarChart(
  container,
  points,
  { unit = "", color = "#85d7f5", height = 185 } = {},
) {
  if (!container) return;
  const clean = points.filter((point) => number(point.value) !== null);
  container.innerHTML = "";
  if (!clean.length) {
    container.innerHTML =
      '<div class="empty-chart">No chart data is available.</div>';
    return;
  }
  const width = 760;
  const pad = { top: 14, right: 16, bottom: 30, left: 30 };
  const max = Math.max(1, ...clean.map((item) => item.value)) * 1.15;
  const plotWidth = width - pad.left - pad.right;
  const gap = 7;
  const barWidth = Math.max(
    7,
    (plotWidth - gap * (clean.length - 1)) / clean.length,
  );
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `Bar chart with ${clean.length} data points`,
  });
  [0, 0.5, 1].forEach((ratio) => {
    const gy = pad.top + ratio * (height - pad.top - pad.bottom);
    svg.append(
      svgElement("line", {
        x1: pad.left,
        y1: gy,
        x2: width - pad.right,
        y2: gy,
        stroke: "currentColor",
        "stroke-opacity": ".09",
        "stroke-dasharray": "3 6",
      }),
    );
  });
  clean.forEach((item, index) => {
    const barHeight = Math.max(
      2,
      (item.value / max) * (height - pad.top - pad.bottom),
    );
    const bx = pad.left + index * (barWidth + gap);
    const by = height - pad.bottom - barHeight;
    const rect = svgElement("rect", {
      x: bx,
      y: by,
      width: barWidth,
      height: barHeight,
      rx: Math.min(5, barWidth / 3),
      fill: color,
      "fill-opacity": ".82",
    });
    const title = svgElement("title");
    title.textContent = `${item.label}: ${item.value}${unit}`;
    rect.append(title);
    svg.append(rect);
    if (
      index % Math.ceil(clean.length / 8) === 0 ||
      index === clean.length - 1
    ) {
      const label = svgElement("text", {
        x: bx + barWidth / 2,
        y: height - 8,
        fill: "currentColor",
        "fill-opacity": ".55",
        "font-size": "9",
        "text-anchor": "middle",
        "font-family": "DM Sans, sans-serif",
      });
      label.textContent = item.label;
      svg.append(label);
    }
  });
  container.append(svg);
}
