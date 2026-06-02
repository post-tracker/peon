const https = require( 'https' );
const querystring = require( 'querystring' );

const TOKEN_HOSTNAME = 'www.reddit.com';
const TOKEN_PATH = '/api/v1/access_token';
const OK_STATUS_CODE = 200;

// Refresh a little before the token actually expires so an in-flight request
// never races the expiry.
const EXPIRY_SKEW_MS = 60000;
const SECONDS_TO_MS = 1000;

let cachedToken = null;
let tokenExpiresAt = 0;

// Reddit asks for a unique, descriptive user-agent. Honour an explicit override,
// otherwise build one that names the bot and (when known) the owning account.
const userAgent = function userAgent () {
    if ( process.env.REDDIT_USER_AGENT ) {
        return process.env.REDDIT_USER_AGENT;
    }

    const account = process.env.REDDIT_USERNAME ? ` (by /u/${ process.env.REDDIT_USERNAME })` : '';

    return `post-tracker peon${ account }`;
};

const basicAuthHeader = function basicAuthHeader () {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if ( !clientId || !clientSecret ) {
        throw new Error( 'Reddit OAuth requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET' );
    }

    const encoded = Buffer.from( `${ clientId }:${ clientSecret }` ).toString( 'base64' );

    return `Basic ${ encoded }`;
};

// Script apps authenticate as a user (password grant); web/confidential apps use
// application-only auth (client_credentials). Pick based on which env vars are set.
const grantBody = function grantBody () {
    if ( process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD ) {
        return querystring.stringify( {
            grant_type: 'password',
            password: process.env.REDDIT_PASSWORD,
            username: process.env.REDDIT_USERNAME,
        } );
    }

    return querystring.stringify( {
        grant_type: 'client_credentials',
    } );
};

const fetchToken = function fetchToken () {
    return new Promise( ( resolve, reject ) => {
        const payload = grantBody();
        const options = {
            headers: {
                authorization: basicAuthHeader(),
                'content-length': Buffer.byteLength( payload ),
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': userAgent(),
            },
            hostname: TOKEN_HOSTNAME,
            method: 'POST',
            path: TOKEN_PATH,
        };

        const request = https.request( options, ( response ) => {
            let body = '';

            response.setEncoding( 'utf8' );
            response.on( 'data', ( chunk ) => {
                body = `${ body }${ chunk }`;
            } );

            response.on( 'end', () => {
                if ( response.statusCode !== OK_STATUS_CODE ) {
                    reject( new Error( `Reddit token request failed with status ${ response.statusCode }` ) );

                    return;
                }

                let parsed;

                try {
                    parsed = JSON.parse( body );
                } catch ( parseError ) {
                    reject( parseError );

                    return;
                }

                const lifetimeMs = parsed.expires_in * SECONDS_TO_MS;

                cachedToken = parsed.access_token;
                tokenExpiresAt = Date.now() + lifetimeMs;

                resolve( cachedToken );
            } );
        } );

        request.on( 'error', ( error ) => {
            reject( error );
        } );

        request.write( payload );
        request.end();
    } );
};

// Returns a valid bearer token, fetching a fresh one when missing or near expiry.
const getToken = function getToken () {
    if ( cachedToken && Date.now() < tokenExpiresAt - EXPIRY_SKEW_MS ) {
        return Promise.resolve( cachedToken );
    }

    return fetchToken();
};

// Drops the cached token so the next getToken() call re-authenticates. Used to
// recover from a 401 (e.g. a token revoked before its stated expiry).
const invalidateToken = function invalidateToken () {
    cachedToken = null;
    tokenExpiresAt = 0;
};

module.exports = {
    getToken,
    invalidateToken,
    userAgent,
};
