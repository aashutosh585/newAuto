# JobSpy Notes

## Repository
- **Upstream**: [speedyapply/JobSpy](https://github.com/speedyapply/JobSpy)
- **Role**: Multi-board job scraper (Indeed, LinkedIn, Glassdoor, ZipRecruiter) without browser automation overhead.

## Architecture in Social Engine
1. **Isolated Microservice (`apps/jobspy-service`)**:
   - Packaged as a Python FastAPI container.
   - Prevents heavy Python pandas/scipy/BeautifulSoup dependencies from contaminating the Node.js monorepo.
   - Exposes clean `POST /search` endpoint.

2. **Integration with Engine**:
   - `JobSpyCollector` (`niches/jobs/src/collectors/jobspy.ts`) sends search queries.
   - Converts scraped jobs into generic `RawItem` schema.
   - Computes `dedupeHash = sha256(company + title + location)`.

3. **Fallback & Quality Guardrails**:
   - Complemented with official ATS JSON endpoints (Greenhouse, Lever) so the system never depends exclusively on web scraping.
   - Apply links are validated with `checkUrlLiveness` before passing to ranking.

