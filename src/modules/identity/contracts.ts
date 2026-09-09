export type Actor = {
	subject: string;
};

export interface IdentityService {
	getActor(request: Request): Promise<Actor | null>;
	requireActor(request: Request): Promise<Actor>;
}
