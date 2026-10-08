import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { ndjsonLines } from "./ndjson";

it("keeps Unicode line separators inside NDJSON strings", async () => {
	const input = Readable.from([
		'{"address":"Houston,\u2028',
		'TX"}\n{"address":"A\u2029B"}\r\n',
	]);
	const lines = [];
	for await (const line of ndjsonLines(input)) lines.push(JSON.parse(line));
	expect(lines).toEqual([
		{ address: "Houston,\u2028TX" },
		{ address: "A\u2029B" },
	]);
});
