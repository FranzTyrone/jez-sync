import type { FastifyRequest, FastifyReply } from "fastify";
export declare function authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
declare module "fastify" {
    interface FastifyRequest {
        user?: {
            id: string;
        };
    }
}
//# sourceMappingURL=auth.d.ts.map