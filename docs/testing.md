# Testing

Run the commands in the README from a clean checkout. Fast contract tests substitute a transport and use dummy merchant material. PostgreSQL integration tests initialize a new cluster, execute the numbered migrations, set database roles and JWT-sub context within each connection and race actual database requests. Browser tests run the built Vite preview with deployment headers and a persistent PGlite worker.

Playwright requires an installed Chromium. Set CAPTURE_SCREENS=1 for the browser suite to regenerate the collection and order screenshots. Accessibility checks cover the listed viewports using axe. Periodically check screen reader announcements, zoom, long order print pagination and slow-network first load manually.

The critical negative cases include rejected callback methods, malformed encrypted forms, mismatched amounts, unauthenticated/cross-owner reads, conflicting order references, double handoff, rate limits, staff-only actions, request-body limits and invalid image bytes. The hosted-auth helper and router are tested with controlled transports. Hosted delivery, product-specific merchant statuses and sandbox settlement require independent evidence.

[Recorded results](verification/05-qa-results.md) · [Release matrix](verification/07-release-gates.md)
