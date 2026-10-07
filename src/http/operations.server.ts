import { z } from "zod";
import type { Database } from "../db/client.server";
import * as events from "../modules/events/index.server";
import type { Actor } from "../modules/identity/index.server";
import * as places from "../modules/places/index.server";
import { findAvailability } from "../modules/planning/index.server";
import * as tags from "../modules/taxonomy/index.server";
import { DomainError } from "../shared/errors";
import {
	availabilitySchema,
	dateSchema,
	idSchema,
	listSchema,
} from "../shared/validation";
import { api, errorResponse, query, readJson } from "./api.server";
import { corsResponse, preflight } from "./cors.server";
import * as out from "./responses";

type Context = {
	db: Database;
	actor: Actor | null;
	params: Record<string, string>;
};
type Operation = {
	method: string;
	path: string;
	operationId: string;
	summary: string;
	status: number;
	body?: z.ZodType;
	query?: z.ZodObject;
	response?: z.ZodType;
	handle(
		request: Request,
		params: Record<string, string>,
		versioned: boolean,
	): Promise<Response>;
};
function operation<B extends z.ZodType, Q extends z.ZodObject>(
	method: string,
	path: string,
	operationId: string,
	summary: string,
	options: { body?: B; query?: Q; response?: z.ZodType; status?: number },
	run: (
		context: Context,
		body: z.output<B>,
		query: z.output<Q>,
	) => Promise<unknown>,
): Operation {
	const status = options.status ?? 200;
	return {
		method,
		path,
		operationId,
		summary,
		...options,
		status,
		handle: (request, params, versioned) =>
			api(
				request,
				method !== "GET",
				async (db, actor) => {
					for (const key of Object.keys(params))
						params[key] = (key === "date" ? dateSchema : idSchema).parse(
							params[key],
						);
					const body = options.body
						? await readJson(request, options.body)
						: undefined;
					const search = options.query
						? query(request, options.query)
						: undefined;
					const result = await run(
						{ db, actor, params },
						body as z.output<B>,
						search as z.output<Q>,
					);
					if (!versioned || !options.response) return result;
					const parsed = options.response.safeParse(
						JSON.parse(JSON.stringify(result)),
					);
					if (!parsed.success)
						throw new Error(`Invalid API response for ${operationId}`, {
							cause: parsed.error,
						});
					return parsed.data;
				},
				status,
			),
	};
}
function owner(actor: Actor | null) {
	if (!actor) throw new DomainError(401, "Sign in to continue");
	return actor;
}
const event = "/events/{eventId}";
const occurrence = `${event}/occurrences/{occurrenceId}`;
const recurrence = `${event}/recurrences/{recurrenceId}`;
const place = "/places/{placeId}";
export const operations = [
	operation(
		"GET",
		"/events",
		"listEvents",
		"List visible events",
		{ query: listSchema, response: z.array(out.eventResponse) },
		({ db, actor }, _, q) => events.listEvents(db, actor, q),
	),
	operation(
		"POST",
		"/events",
		"createEvent",
		"Create an event",
		{ body: events.eventInputSchema, response: out.eventResponse, status: 201 },
		({ db, actor }, body) => events.saveEvent(db, owner(actor), body),
	),
	operation(
		"GET",
		event,
		"getEvent",
		"Get an event with tags, prices and recurrence rules",
		{ response: out.eventDetailResponse },
		({ db, actor, params: p }) => events.getEvent(db, actor, p.eventId),
	),
	operation(
		"PUT",
		event,
		"replaceEvent",
		"Replace event details, tags and default prices",
		{ body: events.eventInputSchema, response: out.eventResponse },
		({ db, actor, params: p }, body) =>
			events.saveEvent(db, owner(actor), body, p.eventId),
	),
	operation(
		"DELETE",
		event,
		"deleteEvent",
		"Delete an event and its occurrences",
		{ status: 204 },
		({ db, actor, params: p }) =>
			events.deleteEvent(db, owner(actor), p.eventId),
	),
	operation(
		"GET",
		`${event}/occurrences`,
		"listOccurrences",
		"List stored occurrences, including month placeholders",
		{ query: listSchema, response: z.array(out.occurrenceResponse) },
		({ db, actor, params: p }, _, q) =>
			events.listOccurrences(db, actor, p.eventId, q),
	),
	operation(
		"POST",
		`${event}/occurrences`,
		"createOccurrence",
		"Create an occurrence or recurrence override",
		{
			body: events.occurrenceInputSchema,
			response: out.savedOccurrenceResponse,
			status: 201,
		},
		({ db, actor, params: p }, body) =>
			events.saveOccurrence(db, owner(actor), p.eventId, body),
	),
	operation(
		"GET",
		occurrence,
		"getOccurrence",
		"Get occurrence details and days",
		{ response: out.occurrenceDetailResponse },
		({ db, actor, params: p }) =>
			events.getOccurrence(db, actor, p.eventId, p.occurrenceId),
	),
	operation(
		"PUT",
		occurrence,
		"replaceOccurrence",
		"Replace an occurrence, or confirm a month placeholder",
		{
			body: events.occurrenceInputSchema,
			response: out.savedOccurrenceResponse,
		},
		({ db, actor, params: p }, body) =>
			events.saveOccurrence(db, owner(actor), p.eventId, body, p.occurrenceId),
	),
	operation(
		"DELETE",
		occurrence,
		"cancelOccurrence",
		"Cancel an occurrence; retain its recurrence override",
		{ response: out.occurrenceResponse },
		({ db, actor, params: p }) =>
			events.cancelOccurrence(db, owner(actor), p.eventId, p.occurrenceId),
	),
	operation(
		"POST",
		`${event}/recurrences`,
		"createRecurrence",
		"Create a scheduled rule or expected-month recurrence",
		{
			body: events.recurrenceInputSchema,
			response: out.createdRecurrenceResponse,
			status: 201,
		},
		({ db, actor, params: p }, body) =>
			events.createRecurrence(db, owner(actor), p.eventId, body),
	),
	operation(
		"PATCH",
		recurrence,
		"endRecurrence",
		"End a recurrence on an inclusive local date",
		{
			body: z.strictObject({ untilDate: dateSchema }),
			response: out.recurrenceResponse,
		},
		({ db, actor, params: p }, body) =>
			events.endRecurrence(
				db,
				owner(actor),
				p.eventId,
				p.recurrenceId,
				body.untilDate,
			),
	),
	operation(
		"GET",
		"/places",
		"listPlaces",
		"List visible places",
		{ query: listSchema, response: z.array(out.placeResponse) },
		({ db, actor }, _, q) => places.listPlaces(db, actor, q),
	),
	operation(
		"GET",
		"/discovery",
		"listDiscovery",
		"Browse public catalog places in map bounds",
		{ query: places.discoveryQuerySchema, response: out.discoveryResponse },
		({ db }, _, q) => places.listDiscovery(db, q),
	),
	operation(
		"GET",
		"/discovery/clusters",
		"clusterDiscovery",
		"Group public catalog places in map bounds",
		{
			query: places.clusterQuerySchema,
			response: out.discoveryClustersResponse,
		},
		({ db }, _, q) => places.clusterDiscovery(db, q),
	),
	operation(
		"POST",
		"/places",
		"createPlace",
		"Create a place",
		{ body: places.placeInputSchema, response: out.placeResponse, status: 201 },
		({ db, actor }, body) => places.savePlace(db, owner(actor), body),
	),
	operation(
		"GET",
		place,
		"getPlace",
		"Get a place with prices and opening hours",
		{ response: out.placeDetailResponse },
		({ db, actor, params: p }) => places.getPlace(db, actor, p.placeId),
	),
	operation(
		"PUT",
		place,
		"replacePlace",
		"Replace place details, tags and prices",
		{ body: places.placeInputSchema, response: out.placeResponse },
		({ db, actor, params: p }, body) =>
			places.savePlace(db, owner(actor), body, p.placeId),
	),
	operation(
		"DELETE",
		place,
		"deletePlace",
		"Delete an unreferenced place",
		{ status: 204 },
		({ db, actor, params: p }) =>
			places.deletePlace(db, owner(actor), p.placeId),
	),
	operation(
		"PUT",
		`${place}/hours`,
		"replacePlaceHours",
		"Replace seasonal opening schedules",
		{
			body: z.array(places.scheduleSchema).max(100),
			response: out.hoursResponse,
		},
		({ db, actor, params: p }, body) =>
			places.replaceSchedules(db, owner(actor), p.placeId, body),
	),
	operation(
		"PUT",
		`${place}/exceptions`,
		"savePlaceException",
		"Replace the opening-hours exception for a date",
		{ body: places.exceptionSchema, response: out.exceptionResponse },
		({ db, actor, params: p }, body) =>
			places.saveException(db, owner(actor), p.placeId, body),
	),
	operation(
		"DELETE",
		`${place}/exceptions/{date}`,
		"deletePlaceException",
		"Remove a date exception",
		{ status: 204 },
		({ db, actor, params: p }) =>
			places.deleteException(db, owner(actor), p.placeId, p.date),
	),
	operation(
		"GET",
		"/tags",
		"listTags",
		"Search shared event and place tags",
		{
			query: z.object({ q: z.string().max(100).default("") }),
			response: z.array(out.tagResponse),
		},
		({ db }, _, q) => tags.listTags(db, q.q),
	),
	operation(
		"POST",
		"/tags",
		"createTag",
		"Create a shared tag",
		{ body: tags.tagInputSchema, response: out.tagResponse, status: 201 },
		({ db }, body) => tags.createTag(db, body),
	),
	operation(
		"GET",
		"/availability",
		"findAvailability",
		"Find events and open places at an instant near a location",
		{ query: availabilitySchema, response: out.availabilityResponse },
		({ db, actor }, _, q) => findAvailability(db, actor, q),
	),
];
export async function dispatch(request: Request) {
	try {
		const pathname = new URL(request.url).pathname.replace(/\/$/, "");
		const versioned = pathname.startsWith("/api/v1/");
		const path = pathname.slice(versioned ? 7 : 4);
		const matches = operations.flatMap((operation) => {
			const keys = [...operation.path.matchAll(/\{(\w+)\}/g)].map(
				(match) => match[1],
			);
			const match = new RegExp(
				`^${operation.path.replace(/\{\w+\}/g, "([^/]+)")}$`,
			).exec(path);
			return match
				? [
						{
							operation,
							params: Object.fromEntries(
								keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]),
							),
						},
					]
				: [];
		});
		if (!matches.length) throw new DomainError(404, "Endpoint not found");
		const methods = matches.map(({ operation }) => operation.method);
		if (request.method === "OPTIONS") return preflight(request, methods);
		const match = matches.find(
			({ operation }) => operation.method === request.method,
		);
		if (!match) {
			const response = errorResponse(
				new DomainError(405, "Method not allowed"),
			);
			response.headers.set("Allow", [...methods, "OPTIONS"].join(", "));
			return corsResponse(request, response);
		}
		return await match.operation.handle(request, match.params, versioned);
	} catch (error) {
		return corsResponse(request, errorResponse(error));
	}
}
export const handlers = Object.fromEntries(
	["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].map((method) => [
		method,
		({ request }: { request: Request }) => dispatch(request),
	]),
);
