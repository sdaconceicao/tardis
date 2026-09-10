import { createFileRoute } from "@tanstack/react-router";

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tardis API</title>
  <link rel="stylesheet" href="/api-docs/swagger-ui.css">
</head>
<body>
  <nav><a href="/api/docs">Domain API</a> · <a href="/api/docs?auth=1">Authentication API</a></nav>
  <div id="swagger-ui"></div>
  <script src="/api-docs/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: new URLSearchParams(location.search).has("auth")
        ? "/api/auth/open-api/generate-schema" : "/api/openapi.json",
      dom_id: "#swagger-ui",
      withCredentials: true,
      persistAuthorization: false,
      validatorUrl: null
    });
  </script>
</body>
</html>`;
export const Route = createFileRoute("/api/docs")({
	server: {
		handlers: {
			GET: () =>
				new Response(html, {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": "no-store",
					},
				}),
		},
	},
});
