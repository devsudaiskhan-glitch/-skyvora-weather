# Performance Testing — Skyvora Weather 5.2.2

## Static audit

Run:

```bash
npm run audit:production
```

This checks selected first-party asset sizes against conservative raw-size budgets, reports gzip estimates, and checks a few source-level performance/accessibility safeguards. It is **not** Lighthouse, a browser trace, a Core Web Vitals measurement or proof of fast loading on a real network.

## Lighthouse (run against the local or deployed site)

1. Install dependencies and start Skyvora.
2. Open Chrome DevTools → Lighthouse.
3. Run separate Mobile and Desktop audits for Performance, Accessibility, Best Practices and SEO.
4. Save the report and record the exact URL, build version, device profile, date and network/CPU throttling.
5. Repeat after fixes using the same settings.

You can also use the Lighthouse CLI if it is installed in your environment:

```bash
npx lighthouse http://localhost:5065 --preset=desktop --view
npx lighthouse http://localhost:5065 --preset=mobile --view
```

## Core Web Vitals targets

Use field data from real users where available. For lab/diagnostic runs, investigate results against these common “good” thresholds:

- LCP: 2.5 seconds or less.
- INP: 200 milliseconds or less.
- CLS: 0.1 or less.

Measure at the 75th percentile for field data when sufficient traffic exists. Do not infer Core Web Vitals from file sizes or a single local Lighthouse run.

## Investigate

- First-party JS/CSS transfer size and unused code.
- Font loading and layout shifts.
- Scenic image dimensions, formats, loading priority and caching.
- Leaflet/map tile requests and third-party script cost.
- API request count, duplicate calls, timeouts and stale-cache fallback.
- Main-thread long tasks and interaction latency.
- Mobile CPU/network behavior, not just desktop broadband.

Keep third-party provider assets and weather-data latency separate from first-party app performance in the report.


For the V5.2.2 changes and the exact checks performed, see [V5.2.2 Performance Notes](V5.2.2-PERFORMANCE-NOTES.md).
