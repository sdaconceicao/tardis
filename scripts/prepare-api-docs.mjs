import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const destination = new URL("../public/api-docs/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ["swagger-ui-bundle.js", "swagger-ui.css"]) {
	await copyFile(require.resolve(`swagger-ui-dist/${file}`), new URL(file, destination));
}
