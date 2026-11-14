# Skyvora Weather — Project Architecture

This project is split by responsibility. Keep browser code, server code, automated checks and product documentation separate; avoid adding new features to the root directory.

## Directory map

```text
skyvora-weather/
├── backend/
│   ├── config/          # Database connection and environment setup
│   ├── middleware/      # Shared request and error handling
│   ├── models/          # MongoDB schemas and persistence models
│   ├── routes/          # HTTP endpoints and request orchestration
│   ├── services/        # Open-Meteo provider access and HTTP policy
│   └── utils/           # Input validation and small server helpers
├── frontend/
│   ├── assets/          # Brand marks and static media
│   ├── css/             # Design tokens, component styles, responsive and brand layers
│   ├── js/
│   │   ├── api/         # Backend client
│   │   ├── components/  # Reusable visual components such as charts
│   │   ├── localization/# Interface copy and language configuration
│   │   ├── services/    # Browser storage, notifications and PWA lifecycle
│   │   └── utils/       # Weather, search, solar, scene and series helpers
│   ├── index.html       # Accessible application shell
│   ├── manifest.webmanifest
│   └── service-worker.js
├── docs/                # Architecture, QA, provider and release documentation
├── scripts/             # Static checks and release audits
├── tests/               # Node.js unit and regression tests
├── .env.example         # Safe environment-variable template
├── package.json
└── README.md
```

## Runtime flow

1. `frontend/index.html` loads the stylesheets and the ES module entry point.
2. `frontend/js/app.js` coordinates the application views and user interactions.
3. Feature helpers under `frontend/js/` handle API calls, chart rendering, local preferences, search ranking, weather calculations and PWA behavior.
4. The browser API client calls the same-origin Express routes. Provider credentials, if configured, remain on the server.
5. `backend/routes/` validates requests and delegates provider work to `backend/services/`.
6. MongoDB is optional. When configured, models support weather caching and non-personal API metrics; the application can still serve weather without database persistence.

## Code conventions

- Use descriptive names that communicate intent; prefer small helpers with one responsibility.
- Keep provider URLs, timeouts, retries and secrets on the server.
- Validate all external input at the route boundary and all provider payload assumptions in the service layer.
- Do not fabricate unavailable weather values or label cached data as live.
- Keep DOM rendering and event delegation in the frontend controller; move reusable calculations into `utils/` and reusable UI into `components/`.
- Use semantic HTML, visible focus states, accessible labels and reduced-motion support.
- Add or update tests whenever a calculation, validation rule, release identity or user-visible behavior changes.
- Never commit `.env`, database credentials, API keys, `node_modules/`, generated reports or local cache data.

## Compatibility note

The `skycast.v2.` local-storage prefix and `skycast-local` IndexedDB database name are intentionally retained. They are internal persistence identifiers from the previous SkyCast release; keeping them avoids discarding saved locations, preferences and journal data during the Skyvora rebrand.
