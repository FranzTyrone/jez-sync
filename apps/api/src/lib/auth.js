"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateRequest = authenticateRequest;
const jwt_1 = require("@auth/core/jwt");
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET is not set");
}
// Auth.js v5 uses either 'authjs.session-token' (dev) or '__Secure-authjs.session-token' (prod with HTTPS)
const COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];
async function authenticateRequest(request, reply) {
    try {
        // Find the session cookie and its name
        let sessionToken;
        let cookieName = "authjs.session-token";
        for (const name of COOKIE_NAMES) {
            if (request.cookies[name]) {
                sessionToken = request.cookies[name];
                cookieName = name;
                console.log(`Found session cookie: ${cookieName}`);
                break;
            }
        }
        if (!sessionToken) {
            console.warn("No session cookie found");
            return reply.status(401).send({ error: "Unauthorized: no session" });
        }
        // Decode the JWE token
        // In Auth.js v5, decode() requires the salt parameter equal to the cookie name
        console.log(`[AUTH] Decoding token with salt="${cookieName}", secret length=${AUTH_SECRET.length}`);
        const decoded = await (0, jwt_1.decode)({
            token: sessionToken,
            secret: AUTH_SECRET,
            salt: cookieName,
        });
        console.log("[AUTH] ✅ Decoded token payload:", decoded);
        console.log("[AUTH] Full payload JSON:", JSON.stringify(decoded, null, 2));
        if (!decoded) {
            console.warn("Failed to decode token");
            return reply.status(401).send({ error: "Unauthorized: invalid token" });
        }
        // Auth.js v5 stores user id in token.sub by default (subject claim)
        const userId = decoded.sub || decoded.id;
        if (!userId) {
            console.warn("No user id found in token:", decoded);
            return reply.status(401).send({ error: "Unauthorized: no user id" });
        }
        request.user = { id: userId };
        console.log(`Authenticated user: ${userId}`);
    }
    catch (err) {
        console.error("Auth middleware error:", err);
        return reply.status(401).send({ error: "Unauthorized: token error" });
    }
}
//# sourceMappingURL=auth.js.map