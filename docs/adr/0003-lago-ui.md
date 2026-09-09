# ADR 0003: Use Lago directly and keep the UI layer thin

- Status: Accepted
- Date: 2026-09-08

## Decision

Load `@code-x/lago` styles at the application root and import Lago components
directly where needed. Use its design tokens in application CSS. Do not build a
parallel primitive or wrapper layer for possible upstream changes.

Create local UI components only for product-specific behavior, accessibility,
or repeated compositions that have meaning in Tardis.

## Consequences

- The UI has less indirection and less code to maintain.
- Tardis intentionally accepts direct coupling to Lago's public API.
- Product-specific components remain easy to identify.
