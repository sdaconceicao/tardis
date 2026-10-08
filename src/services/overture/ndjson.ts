import type { Readable } from "node:stream";

export async function* ndjsonLines(input: Readable): AsyncGenerator<string> {
	input.setEncoding("utf8");
	let pending = "";
	for await (const chunk of input) {
		pending += chunk as string;
		let newline = pending.indexOf("\n");
		while (newline !== -1) {
			const line = pending.slice(0, newline);
			yield line.endsWith("\r") ? line.slice(0, -1) : line;
			pending = pending.slice(newline + 1);
			newline = pending.indexOf("\n");
		}
	}
	if (pending) yield pending;
}
