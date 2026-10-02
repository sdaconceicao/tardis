# ADR 0001: Start with a modular monolith

- Status: Accepted
- Date: 2026-09-08

## Context

The MVP must be open source and inexpensive to operate. Events and routing may
eventually scale differently from authentication and CRUD traffic, but separate
deployments would add networking, observability, deployment, and data
consistency costs before those needs are measured.

## Decision

Build one TanStack Start application deployed on Vercel. TanStack server
functions form the BFF. Organize business capabilities as modules with explicit
public contracts and keep framework-specific request handling outside domain
logic.

This records the chosen architecture. The current checkout has a frontend shell
and initial contracts; the domain modules and BFF endpoints are still planned.

## Consequences

- Local development and deployment remain simple.
- Modules can share a Neon/PostGIS database and transactions.
- Vercel can horizontally scale stateless request handling.
- Module boundaries require review discipline because TypeScript alone cannot
  prevent every internal import.
- A capability can be extracted after measurements show a concrete reason, but
  extraction will require a versioned wire protocol and operational ownership.
