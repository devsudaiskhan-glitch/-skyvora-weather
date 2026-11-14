# Skyvora Weather 5.2.2 — Production Readiness Gate

This checklist distinguishes source-level checks from verification that must happen on the actual host, database, network and physical devices.

## Source changes verified in this release
- [x] Release identity synchronized across package, backend, frontend, manifest and service-worker cache.
- [x] API requests retain no-store behavior.
- [x] Graceful shutdown drains requests, disconnects MongoDB and has a bounded forced-exit path.
- [x] API rate-limit window and maximum are configurable within bounded safe ranges. The default memory store is per-process and is not a distributed limiter; use a shared store for multi-instance production.
- [x] Coordinate, historical date-range and geocoding result-count validation are isolated and unit tested.
- [x] Weather-provider HTTP handling has bounded timeout, bounded retry and non-retryable validation behavior.
- [x] Provider timeout, transient recovery and non-retryable response paths are covered by mocked unit tests.
- [x] MongoDB connection timeout is configurable within a bounded range; MongoDB failure is logged and weather service can continue using process-local cache.
- [x] Keyboard skip link, main landmark, visible focus affordance and reduced-motion source support are present.
- [x] No real `.env` or credential is shipped in the ZIP.
- [x] Static asset budget audit is included and explicitly distinguished from Lighthouse.

## Must be completed on the deployment environment
- [ ] Run `npm install` (or a reviewed reproducible dependency install) and `npm test`, `npm run check`, `npm run audit:production` on the release artifact.
- [ ] Run dependency vulnerability review (`npm audit`) and resolve or document findings.
- [ ] Set `NODE_ENV=production` and protect environment variables.
- [ ] Set `TRUST_PROXY` to the exact trusted proxy hop count for the host; never guess.
- [ ] Configure HTTPS, DNS, reverse proxy, TLS renewal, firewall and host-level request limits.
- [ ] Confirm CSP and external domains against the deployed asset set.
- [ ] Confirm API rate limiting is adequate. The current default memory store is per process; use a shared store for multi-instance production.
- [ ] Configure monitoring, log retention, uptime checks and incident alerts.
- [ ] Review Open-Meteo terms, attribution and commercial-use requirements for the intended deployment.
- [ ] Test upstream latency, retry, timeout, malformed/missing data, rate limiting, stale fallback and recovery on the target network.

## MongoDB acceptance
- [ ] Set `MONGODB_URI` to a least-privilege account with TLS where supported.
- [ ] Start the service and verify `/api/health` reports `database: connected`.
- [ ] Fetch weather and verify a cache record is written; repeat the same request and verify cache behavior.
- [ ] Restart the app and verify persisted cache can be read from MongoDB.
- [ ] Temporarily make MongoDB unavailable and verify weather requests remain available with process-local cache where possible.
- [ ] Restore MongoDB and verify the connection recovers; confirm metrics and cache writes resume.
- [ ] Configure backups and perform a restore rehearsal before relying on persistence.

## Visual, accessibility and performance acceptance
- [ ] Complete the viewport/device pass in `docs/VISUAL-QA-RUNBOOK.md`.
- [ ] Complete keyboard and assistive-technology checks in `docs/ACCESSIBILITY-TESTING.md`.
- [ ] Run mobile and desktop Lighthouse audits and record the reports.
- [ ] Measure field Core Web Vitals when traffic permits; do not infer them from static checks.
- [ ] Test PWA install, update and offline behavior on HTTPS and physical target devices.

## Release rule
V5.2.2 is a more thoroughly tested source release, **not a production deployment or 10/10 certification**. Do not mark unchecked host/device/database checks as passed. Keep the QA report updated with actual evidence and any known failures.
