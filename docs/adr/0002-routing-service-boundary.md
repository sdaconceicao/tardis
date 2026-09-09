# ADR 0002: Put routing behind an extractable service boundary

- Status: Accepted
- Date: 2026-09-08

## Context

Routing calls are more expensive and failure-prone than ordinary application
reads. They depend on a third-party provider, may encounter quotas, and may
eventually need independent caching and scaling.

## Decision

Expose routing through a provider-neutral `RoutingService`. The initial service
runs in the monolith and delegates to an OpenRouteService adapter. Callers use
normalized coordinates, travel profiles, metrics, geometry, and explicit
unavailable states. Requests are bounded before reaching the provider.

Routes, server functions, and domain modules must not import the provider
adapter or OpenRouteService response types directly.

## Consequences

- The MVP avoids a second service deployment.
- Validation and provider failure behavior are consistent.
- An HTTP client can replace the in-process implementation without changing
  callers.
- The future network contract still needs schema versioning, authentication,
  idempotency decisions, and contract tests before extraction.
