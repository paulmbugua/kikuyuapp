const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../../config/env');

const STATE_COOKIE = 'kikuyu_google_oauth_state';
const callbackPath = new URL(config.googleOAuth.redirectUri).pathname;
const oauthClient = new OAuth2Client({
  clientId: config.googleOAuth.clientId,
  clientSecret: config.googleOAuth.clientSecret,
  redirectUri: config.googleOAuth.redirectUri
});

const createState = () => jwt.sign(
  { purpose: 'google-oauth', nonce: crypto.randomBytes(24).toString('hex') },
  config.jwt.secret,
  { expiresIn: config.googleOAuth.stateTtl, audience: 'google-oauth', issuer: 'kikuyuapp' }
);

const verifyState = (state, cookieState) => {
  if (!state || !cookieState) return false;
  const stateBuffer = Buffer.from(state);
  const cookieBuffer = Buffer.from(cookieState);
  if (stateBuffer.length !== cookieBuffer.length || !crypto.timingSafeEqual(stateBuffer, cookieBuffer)) return false;
  const payload = jwt.verify(state, config.jwt.secret, { audience: 'google-oauth', issuer: 'kikuyuapp' });
  return payload.purpose === 'google-oauth';
};

const getAuthorizationUrl = (state) => oauthClient.generateAuthUrl({
  access_type: 'online',
  include_granted_scopes: true,
  prompt: 'select_account',
  scope: ['openid', 'email', 'profile'],
  state
});

const exchangeCodeForProfile = async (code) => {
  const { tokens } = await oauthClient.getToken(code);
  if (!tokens.id_token) throw new Error('Google did not return an ID token');
  const ticket = await oauthClient.verifyIdToken({ idToken: tokens.id_token, audience: config.googleOAuth.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('Google account must have a verified email address');
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
    emailVerified: true
  };
};

const parseCookies = (cookieHeader = '') => Object.fromEntries(
  cookieHeader.split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const separator = entry.indexOf('=');
    return [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))];
  })
);

const stateCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: callbackPath
};

module.exports = {
  STATE_COOKIE,
  createState,
  exchangeCodeForProfile,
  getAuthorizationUrl,
  parseCookies,
  stateCookieOptions,
  verifyState
};
