const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!issuerDomain) {
    throw new Error('[auth.config] Missing CLERK_JWT_ISSUER_DOMAIN environment variable.');
}

export default {
    providers: [
        {
            domain: issuerDomain,
            applicationID: "convex",
        },
    ],
};
