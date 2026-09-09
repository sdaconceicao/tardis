# MVP operating guardrails

The goal is to remain inside free allowances while usage is small. Provider
terms and quotas change, so deployment owners must verify current limits before
launch and monitor actual usage.

- Keep the application stateless between requests.
- Use the Neon serverless driver and avoid holding idle database connections.
- Put spatial and date filters in PostgreSQL rather than loading broad data sets
  into application memory.
- Bound every date expansion, geospatial radius, result page, and routing
  matrix.
- Route only the short list that remains after spatial, availability, and
  preference filtering.
- Cache provider-neutral routing results by rounded coordinates, profile, and a
  finite lifetime once traffic warrants a cache.
- Treat routing quota exhaustion and timeouts as degraded operation, not as a
  total planning failure.
- Avoid background polling for undefined future event dates. Track a next-check
  date and process only due sources when ingestion is introduced.
- Add paid infrastructure only in response to observed latency, quota, or
  reliability data.

Before public launch, define alerts for server errors, database capacity, and
routing provider usage. Never expose `DATABASE_URL`, auth secrets, or routing
provider keys to browser code or public logs.
