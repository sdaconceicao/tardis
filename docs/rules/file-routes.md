# File Route Standards

Use folder-based TanStack Router routes. Give each URL segment its own folder;
do not pair a flat route file such as `login.tsx` with a `login/` folder.

```
src/routes/
├── __root.tsx
├── (home)/
│   ├── index.tsx
│   └── -components/ExplorePage/ExplorePage.tsx
├── login/
│   ├── route.tsx
│   └── -components/LoginPage/LoginPage.tsx
└── api/
    ├── events/
    │   ├── index.ts
    │   └── $eventId/route.ts
    └── tags/route.ts
```

- Use `route.tsx` for a UI route at a folder's path and `index.tsx` for an
  exact index route. Use `route.ts` and `index.ts` for API routes.
- Keep route-owned page components in that route's `-components` folder, with
  PascalCase component folders and files. Keep shared components in
  `src/components`. Colocate each component's CSS Module with its TSX file.
- Keep `__root.tsx` at the route root as required by TanStack Router. The
  pathless `(home)` group holds the `/` index route and its components.
- When moving routes, regenerate `src/routeTree.gen.ts` with
  `pnpm generate-routes` and verify the public paths stay the same. Use the
  generated `createFileRoute` path for each moved route.
