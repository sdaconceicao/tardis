export class DomainError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}
export const notFound = () => new DomainError(404, "Record not found");
export const conflict = (message: string) => new DomainError(409, message);
