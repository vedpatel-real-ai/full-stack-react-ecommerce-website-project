# QA results

Local verification used macOS arm64, Node v24.14.0, npm 11.9.0, PostgreSQL 18.7 and Chromium headless shell revision 1255. Test records are synthetic. The Linux Actions job repeats these checks on Node 24.

| Scope                                        | Command                                                                              | Result                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Commercial baseline                          | npm ci --offline --ignore-scripts --no-audit, npm test                               | 37 passed, 0 failed, 0 skipped in 6 Vitest files                                                                |
| Commercial browser baseline                  | npm run test:e2e with CHROMIUM_EXECUTABLE_PATH pointing at installed revision 1255   | 6 passed, 0 failed, 0 skipped, 18.2 s; local simulator                                                          |
| Old personal baseline                        | npm ci --ignore-scripts --no-audit; CI=true npm test -- --watchAll=false --runInBand | 1 suite failed loading react-router-dom, 0 test cases executed                                                  |
| Destination install                          | npm ci --no-audit                                                                    | Clean lockfile installation completed                                                                           |
| Style                                        | npm run format:check; npm run lint                                                   | Passed                                                                                                          |
| Financial, HTTP, auth, media, pricing and DB | npm test                                                                             | 25 passed, 0 failed, 0 skipped; 13 native PostgreSQL tests                                                      |
| Public artifact                              | npm run build; npm run check:secrets                                                 | Passed; relative documentation links, secret patterns, source maps, server config and entry-size budget checked |
| Hosted source compile                        | npm run check:staging                                                                | Passed without an approved binding, credentials or network transport                                            |
| Dependencies                                 | npm audit --audit-level=moderate                                                     | 0 known vulnerabilities returned                                                                                |
| Browser                                      | CAPTURE_SCREENS=1 npm run test:e2e                                                   | 10 passed, 0 failed, 0 skipped in 53.1 s                                                                        |
| Accessibility                                | axe in the built browser suite                                                       | 0 tested-rule violations on collection at 390×844, 768×1024, 1280×900 and 1600×1000                             |
| Hosted Supabase                              | Requires approved independent project                                                | BLOCKED. No hosted Auth, Storage or RLS certification                                                           |
| Merchant sandbox / production                | Requires merchant-specific integration and separate authorization                    | BLOCKED. Zero provider payments, refunds or chargebacks executed                                                |

The source baseline initially lacked Playwright's requested revision 1248. Its full browser suite passed on installed revision 1255. During development, a migration argument conflicted with a PostgreSQL keyword and a review refresh removed the confirmation message. Both issues were corrected and the complete affected suites were rerun.

The measured production entry is about 276 kB (87 kB gzip) and the CSS is about 6 kB. Native browser SQL has a separate first-load cost of about 9.09 MB WASM and 6.25 MB data before compression. The build reports upstream PGlite direct-eval and Node module externalization warnings. Browser runs used the supplied security headers. npm reports that the pinned ESLint 9 version is deprecated. Field Core Web Vitals, a full manual accessibility audit, screen-reader behavior and external provider delivery have not been measured.

[Desktop collection](../images/collection-1280.png) · [Mobile collection](../images/collection-390.png) · [Order statement](../images/order.png)
