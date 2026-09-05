# BetterPortal Config Manager

Admin-oriented BetterPortal service that discovers enabled service bindings and their BP config schema surfaces.

PostgreSQL presence updates use a separate activity table (created on startup), without changing the platform config revision. Presence reads are cached for five seconds; real config writes always enqueue replica invalidation. Setup, bootstrap and hostname-change completions commit their leased result and config change in one transaction.

Identical preview deployment POST retries replay the original response, including credentials, for 15 minutes. Only the latest request per deployment is retained, encrypted with the control-plane identity; preserve that identity across replicas and restarts. GET never returns the replay record. Expired replay records are removed by maintenance. An identical POST within this window is a retry, not a fresh production-config sync.

Config streams revalidate credentials on updates, coalesce concurrent changes and omit unchanged payloads. Webhook delivery remains at-least-once: receivers must deduplicate by `x-bp-webhook-id`. Each attempt has a 10-second request deadline and is leased immediately before delivery.
