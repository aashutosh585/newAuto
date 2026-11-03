# Postmill (Backup Publisher) Notes

## Repository
- **Upstream**: [postmill-ai/postmill-app](https://github.com/postmill-ai/postmill-app)
- **Role**: Open-source, self-hosted social media publisher (AGPL-3.0).

## Status in Social Engine v3
- **Primary Publisher**: Zernio API (hosted).
- **Secondary / Backup Role**: Postmill is maintained as a ready-to-run drop-in publisher inside `packages/core/src/publisher/postmill.ts`.
- **How to Switch**:
  - Set `PUBLISHER_TYPE=postmill` in `.env`.
  - Provide `POSTMILL_API_URL` and `POSTMILL_API_KEY`.
  - The `PublisherFactory` switches dynamically with zero business logic changes.

