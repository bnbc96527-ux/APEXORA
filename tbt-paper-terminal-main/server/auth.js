import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, 'data');
const STORE_PATH = resolve(DATA_DIR, 'auth-store.json');

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_TTL_MS = 20 * 60 * 1000;
const TWO_FACTOR_SETUP_TTL_MS = 10 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

const rateBuckets = new Map();
let cachedStore = null;

const defaultStore = () => ({
  users: [],
  sessions: [],
  audit: [],
});

const now = () => Date.now();

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwarded || req.socket?.remoteAddress || '127.0.0.1';
};

const getUserAgent = (req) => String(req.headers['user-agent'] || 'unknown').slice(0, 255);

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const base64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const base64urlJson = (obj) => base64url(JSON.stringify(obj));

const signJwt = (payload, secret, expiresInSeconds) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp, iat: Math.floor(now() / 1000) };
  const unsigned = `${base64urlJson(header)}.${base64urlJson(body)}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${unsigned}.${signature}`;
};

const verifyJwt = (token, secret) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signature] = parts;
  const unsigned = `${headerB64}.${payloadB64}`;
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

  try {
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

const parseCookies = (header = '') => {
  const cookies = {};
  header.split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index <= 0) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
};

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${String(options.sameSite).charAt(0).toUpperCase()}${String(options.sameSite).slice(1)}`);
  return parts.join('; ');
};

const mergeCookieHeaders = (existing, next) => {
  if (!existing) return Array.isArray(next) ? next : [next];
  return Array.isArray(existing) ? [...existing, next] : [existing, next];
};

const cleanText = (value) => String(value || '').trim().replace(/[<>]/g, '').slice(0, 160);

const normalizeEmail = (value) => cleanText(value).toLowerCase();

const normalizeUsername = (value) => cleanText(value).toLowerCase();

const getEnv = (key, fallback = '') => process.env[key] || fallback;

const isSecureCookieRequest = (req) => {
  if (getEnv('AUTH_COOKIE_SECURE') === 'true') return true;
  if (process.env.NODE_ENV === 'production') return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https';
};

const buildCookieOptions = (req, maxAgeSeconds) => ({
  ...COOKIE_BASE,
  secure: isSecureCookieRequest(req),
  maxAge: maxAgeSeconds,
});

const getSecret = () => {
  const secret = getEnv('AUTH_JWT_SECRET');
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_JWT_SECRET must be set to a strong random string.');
  }
  return secret;
};

const readStore = async () => {
  if (cachedStore) return cachedStore;
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    cachedStore = JSON.parse(raw);
  } catch {
    cachedStore = defaultStore();
  }
  cachedStore.users ??= [];
  cachedStore.sessions ??= [];
  cachedStore.audit ??= [];
  await seedDemoAccounts(cachedStore);
  await saveStore(cachedStore);
  return cachedStore;
};

const saveStore = async (store) => {
  cachedStore = store;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
};

const rateLimit = (scope, key, limit, windowMs) => {
  const bucketKey = `${scope}:${key}`;
  const entry = rateBuckets.get(bucketKey);
  const current = now();
  if (!entry || entry.expiresAt <= current) {
    const next = { count: 1, expiresAt: current + windowMs };
    rateBuckets.set(bucketKey, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.expiresAt };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.expiresAt };
  }
  entry.count += 1;
  rateBuckets.set(bucketKey, entry);
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.expiresAt };
};

const trackAudit = async (store, entry) => {
  store.audit.unshift({ id: randomToken(8), ...entry });
  store.audit = store.audit.slice(0, 2000);
  await saveStore(store);
};

const findUser = (store, loginId) => {
  const target = String(loginId || '').trim().toLowerCase();
  return store.users.find((user) => user.email === target || user.username === target) || null;
};

const findUserByEmail = (store, email) => {
  const target = normalizeEmail(email);
  return store.users.find((user) => user.email === target) || null;
};

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  country: user.country,
  role: user.role,
  emailVerifiedAt: user.emailVerifiedAt || null,
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null,
  lastLoginIp: user.lastLoginIp || null,
  loginActivity: (user.loginActivity || []).slice(0, 10),
});

const hashPassword = async (password) => bcrypt.hash(String(password), BCRYPT_ROUNDS);

const verifyPassword = async (password, hash) => bcrypt.compare(String(password), String(hash || ''));

const createDemoUser = async ({ id, username, email, role, password, createdAtOffsetMs, referralEarningsUSDT = '0' }) => ({
  id,
  username,
  email,
  country: 'US',
  role,
  passwordHash: await hashPassword(password),
  status: 'active',
  emailVerifiedAt: now() - createdAtOffsetMs,
  emailVerificationCodeHash: null,
  emailVerificationExpiresAt: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorPendingSecret: null,
  twoFactorSetupExpiresAt: null,
  resetPasswordCodeHash: null,
  resetPasswordExpiresAt: null,
  createdAt: now() - createdAtOffsetMs,
  loginActivity: [],
  lastLoginAt: now() - 1000 * 60 * 10,
  lastLoginIp: null,
  lastUserAgent: null,
  referralEarningsUSDT,
});

const seedDemoAccounts = async (store) => {
  const bossEmail = normalizeEmail(getEnv('DEMO_BOSS_EMAIL', 'boss@apexora.local'));
  const bossUsername = normalizeUsername(getEnv('DEMO_BOSS_USERNAME', 'boss'));
  const bossPassword = getEnv('DEMO_BOSS_PASSWORD', 'Boss@123456');
  const adminEmail = normalizeEmail(getEnv('DEMO_ADMIN_EMAIL', 'admin@goail.com'));
  const adminUsername = normalizeUsername(getEnv('DEMO_ADMIN_USERNAME', 'admin'));
  const adminPassword = getEnv('DEMO_ADMIN_PASSWORD', 'Admin@123456');

  const existingBoss = store.users.find((user) => user.role === 'boss' || user.email === bossEmail || user.username === bossUsername);
  const existingAdmin = store.users.find((user) => user.role === 'admin' || user.email === adminEmail || user.username === adminUsername);

  if (!existingBoss) {
    store.users.push(await createDemoUser({
      id: 'boss-0001',
      username: bossUsername,
      email: bossEmail,
      role: 'boss',
      password: bossPassword,
      createdAtOffsetMs: 1000 * 60 * 60 * 24 * 60,
    }));
  }

  if (!existingAdmin) {
    store.users.push(await createDemoUser({
      id: 'admin-0001',
      username: adminUsername,
      email: adminEmail,
      role: 'admin',
      password: adminPassword,
      createdAtOffsetMs: 1000 * 60 * 60 * 24 * 45,
      referralEarningsUSDT: '400.00000000',
    }));
  }
};

const createEmailCode = () => String(crypto.randomInt(100000, 999999));

const verifyRecaptcha = async (token, remoteIp) => {
  const demoMode = getEnv('DEMO_MODE') === 'true' || getEnv('AUTH_DEMO_MODE') === 'true';
  if (demoMode) {
    return { ok: true, bypassed: true };
  }

  const secret = getEnv('RECAPTCHA_SECRET_KEY');
  if (!secret) {
    return { ok: false, error: 'reCAPTCHA is not configured on the server.' };
  }
  if (!token) {
    return { ok: false, error: 'reCAPTCHA token is missing.' };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: remoteIp,
  });

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!data?.success) {
    return { ok: false, error: 'reCAPTCHA verification failed.' };
  }

  const expectedHostname = getEnv('RECAPTCHA_EXPECTED_HOSTNAME');
  if (expectedHostname && data.hostname && data.hostname !== expectedHostname) {
    return { ok: false, error: 'reCAPTCHA hostname mismatch.' };
  }

  if (typeof data.score === 'number' && data.score < Number(getEnv('RECAPTCHA_MIN_SCORE', '0.5'))) {
    return { ok: false, error: 'reCAPTCHA score too low.' };
  }

  return { ok: true };
};

const makeTransport = () => {
  const host = getEnv('SMTP_HOST');
  const user = getEnv('SMTP_USER');
  const pass = getEnv('SMTP_PASS');
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(getEnv('SMTP_PORT', '587')),
    secure: getEnv('SMTP_SECURE') === 'true',
    auth: { user, pass },
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  const from = getEnv('SMTP_FROM', getEnv('SMTP_USER', 'no-reply@localhost'));
  const transport = makeTransport();
  if (!transport) {
    console.info('[auth] Email transport not configured. Message logged only.');
    console.info(`[auth] To: ${to}`);
    console.info(`[auth] Subject: ${subject}`);
    console.info(`[auth] Text: ${text}`);
    return;
  }

  await transport.sendMail({ from, to, subject, text, html });
};

const issueSession = async (req, res, user, store) => {
  const secret = getSecret();
  const csrfToken = randomToken(24);
  const sessionId = randomToken(24);
  const accessToken = signJwt({ sub: user.id, sid: sessionId, role: user.role, typ: 'access' }, secret, ACCESS_TTL_SECONDS);
  const refreshToken = signJwt({ sub: user.id, sid: sessionId, role: user.role, typ: 'refresh' }, secret, REFRESH_TTL_SECONDS);

  store.sessions = store.sessions.filter((session) => session.userId !== user.id);
  store.sessions.push({
    id: sessionId,
    userId: user.id,
    refreshTokenHash: sha256(refreshToken),
    expiresAt: now() + REFRESH_TTL_SECONDS * 1000,
    createdAt: now(),
    csrfToken,
  });

  user.lastLoginAt = now();
  user.lastLoginIp = getClientIp(req);
  user.lastUserAgent = getUserAgent(req);
  user.loginActivity = [
    { id: randomToken(6), success: true, at: now(), ip: user.lastLoginIp, userAgent: user.lastUserAgent },
    ...(user.loginActivity || []),
  ].slice(0, 20);

  await saveStore(store);

  res.setHeader('Set-Cookie', [
    serializeCookie('apx_at', accessToken, buildCookieOptions(req, ACCESS_TTL_SECONDS)),
    serializeCookie('apx_rt', refreshToken, buildCookieOptions(req, REFRESH_TTL_SECONDS)),
    serializeCookie('apx_csrf', csrfToken, { ...buildCookieOptions(req, REFRESH_TTL_SECONDS), httpOnly: false }),
  ]);

  return { csrfToken, user: publicUser(user) };
};

const requireAuth = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const authorization = String(req.headers.authorization || '');
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  const token = cookies.apx_at || bearer;
  const secret = getSecret();
  const payload = verifyJwt(token, secret);
  if (!payload || payload.typ !== 'access') {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  const store = await readStore();
  const user = store.users.find((entry) => entry.id === payload.sub);
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  return { store, user, payload, cookies };
};

const ensureActiveUser = (user) => user && user.status === 'active' && !user.disabledAt;

const invalidateUserSessions = async (store, userId) => {
  store.sessions = store.sessions.filter((session) => session.userId !== userId);
  await saveStore(store);
};

const registerAuthRoutes = (app) => {
  authenticator.options = {
    step: 30,
    window: 1,
  };

  app.get('/api/auth/csrf', async (req, res) => {
    const token = randomToken(24);
    res.setHeader('Set-Cookie', serializeCookie('apx_csrf', token, { ...buildCookieOptions(req, REFRESH_TTL_SECONDS), httpOnly: false }));
    res.json({ csrfToken: token });
  });

  app.get('/api/auth/me', async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    res.json({ user: publicUser(auth.user) });
  });

  app.post('/api/auth/register', async (req, res) => {
    const ip = getClientIp(req);
    const { allowed, resetAt } = rateLimit('register', ip, 6, 60 * 60 * 1000);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many registration attempts. Try again later.', retryAfter: resetAt });
    }

    const { email, username, password, country, captchaToken } = req.body || {};
    const captcha = await verifyRecaptcha(captchaToken, ip);
    if (!captcha.ok) return res.status(400).json({ error: captcha.error });

    const cleanEmail = normalizeEmail(email);
    const cleanUsername = normalizeUsername(username);
    const cleanCountry = cleanText(country).toUpperCase().slice(0, 2);
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanEmail.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!cleanUsername || cleanUsername.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    if (cleanPassword.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });

    const store = await readStore();
    const existing = findUser(store, cleanEmail) || store.users.find((entry) => entry.username === cleanUsername);
    if (existing && existing.status !== 'disabled') {
      return res.status(409).json({ error: 'An account with those credentials already exists.' });
    }

    const emailVerificationCode = createEmailCode();
    const verificationExpiresAt = now() + EMAIL_CODE_TTL_MS;
    const passwordHash = await hashPassword(cleanPassword);
    const user = {
      id: randomToken(12),
      username: cleanUsername,
      email: cleanEmail,
      country: cleanCountry || 'US',
      role: 'user',
      passwordHash,
      status: 'pending_email',
      emailVerifiedAt: null,
      emailVerificationCodeHash: sha256(emailVerificationCode),
      emailVerificationExpiresAt: verificationExpiresAt,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorSetupExpiresAt: null,
      resetPasswordCodeHash: null,
      resetPasswordExpiresAt: null,
      createdAt: now(),
      loginActivity: [],
      lastLoginAt: null,
      lastLoginIp: null,
      lastUserAgent: null,
    };

    store.users.push(user);
    await saveStore(store);

    const appName = getEnv('APP_NAME', 'Apexora');
    await sendMail({
      to: user.email,
      subject: `${appName} email verification code`,
      text: `Your verification code is ${emailVerificationCode}. It expires in 15 minutes.`,
      html: `<p>Your verification code is <strong>${emailVerificationCode}</strong>. It expires in 15 minutes.</p>`,
    });

    return res.status(201).json({
      ok: true,
      verificationRequired: true,
      message: 'Registration created. Check your email for the verification code.',
      devVerificationCode: process.env.NODE_ENV === 'production' ? undefined : emailVerificationCode,
      email,
      username,
    });
  });

  app.post('/api/auth/resend-verification', async (req, res) => {
    const ip = getClientIp(req);
    const { email, captchaToken } = req.body || {};
    const captcha = await verifyRecaptcha(captchaToken, ip);
    if (!captcha.ok) return res.status(400).json({ error: captcha.error });

    const store = await readStore();
    const user = findUserByEmail(store, email);
    if (!user) {
      return res.json({ ok: true, message: 'If the account exists, a new code was sent.' });
    }
    if (user.status === 'active') {
      return res.json({ ok: true, alreadyVerified: true });
    }

    const emailVerificationCode = createEmailCode();
    user.emailVerificationCodeHash = sha256(emailVerificationCode);
    user.emailVerificationExpiresAt = now() + EMAIL_CODE_TTL_MS;
    await saveStore(store);

    const appName = getEnv('APP_NAME', 'Apexora');
    await sendMail({
      to: user.email,
      subject: `${appName} verification code resend`,
      text: `Your new verification code is ${emailVerificationCode}. It expires in 15 minutes.`,
      html: `<p>Your new verification code is <strong>${emailVerificationCode}</strong>. It expires in 15 minutes.</p>`,
    });

    return res.json({
      ok: true,
      message: 'If the account exists, a new code was sent.',
      devVerificationCode: process.env.NODE_ENV === 'production' ? undefined : emailVerificationCode,
    });
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    const ip = getClientIp(req);
    const { email, code } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (!cleanEmail || cleanCode.length !== 6) {
      return res.status(400).json({ error: 'Enter the 6-digit verification code.' });
    }

    const store = await readStore();
    const user = findUserByEmail(store, cleanEmail);
    if (!user) return res.status(404).json({ error: 'Unable to verify this account.' });
    if (user.status === 'active') {
      const session = await issueSession(req, res, user, store);
      return res.json({ ok: true, user: session.user, csrfToken: session.csrfToken, alreadyVerified: true });
    }

    if (user.emailVerificationExpiresAt < now() || user.emailVerificationCodeHash !== sha256(cleanCode)) {
      await trackAudit(store, {
        userId: user.id,
        action: 'email_verify_failed',
        ip,
        userAgent: getUserAgent(req),
        at: now(),
      });
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    user.status = 'active';
    user.emailVerifiedAt = now();
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await saveStore(store);

    const session = await issueSession(req, res, user, store);
    await trackAudit(store, {
      userId: user.id,
      action: 'email_verified',
      ip,
      userAgent: getUserAgent(req),
      at: now(),
    });
    return res.json({ ok: true, user: session.user, csrfToken: session.csrfToken });
  });

  app.post('/api/auth/login', async (req, res) => {
    const ip = getClientIp(req);
    const { allowed, resetAt } = rateLimit('login', ip, 12, 15 * 60 * 1000);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait and try again.', retryAfter: resetAt });
    }

    const { identifier, email, username, password, captchaToken, twoFactorCode } = req.body || {};
    const loginId = normalizeEmail(identifier || email || username);
    const captcha = await verifyRecaptcha(captchaToken, ip);
    if (!captcha.ok) return res.status(400).json({ error: captcha.error });

    const store = await readStore();
    const user = findUser(store, loginId);
    if (!user || !ensureActiveUser(user)) {
      await trackAudit(store, {
        userId: user?.id || null,
        action: 'login_failed',
        reason: 'invalid_credentials',
        ip,
        userAgent: getUserAgent(req),
        at: now(),
      });
      return res.status(401).json({ error: 'Sign in failed. Please check your details and try again.' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await trackAudit(store, {
        userId: user.id,
        action: 'login_failed',
        reason: 'invalid_password',
        ip,
        userAgent: getUserAgent(req),
        at: now(),
      });
      return res.status(401).json({ error: 'Sign in failed. Please check your details and try again.' });
    }

    if (user.twoFactorEnabled) {
      const code = String(twoFactorCode || '').replace(/\D/g, '').slice(0, 6);
      if (!code) {
        return res.json({ ok: true, requiresTwoFactor: true, message: 'Two-factor code required.' });
      }
      const valid = authenticator.check(code, user.twoFactorSecret || '');
      if (!valid) {
        await trackAudit(store, {
          userId: user.id,
          action: 'login_failed',
          reason: 'two_factor_invalid',
          ip,
          userAgent: getUserAgent(req),
          at: now(),
        });
        return res.status(401).json({ error: 'Sign in failed. Please check your details and try again.' });
      }
    }

    const session = await issueSession(req, res, user, store);
    await trackAudit(store, {
      userId: user.id,
      action: 'login_success',
      ip,
      userAgent: getUserAgent(req),
      at: now(),
    });
    return res.json({ ok: true, user: session.user, csrfToken: session.csrfToken, requiresTwoFactor: false });
  });

  app.post('/api/auth/refresh', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const secret = getSecret();
    const payload = verifyJwt(cookies.apx_rt, secret);
    if (!payload || payload.typ !== 'refresh') {
      return res.status(401).json({ error: 'Session expired.' });
    }

    const store = await readStore();
    const session = store.sessions.find((entry) => entry.id === payload.sid && entry.refreshTokenHash === sha256(cookies.apx_rt));
    const user = store.users.find((entry) => entry.id === payload.sub && entry.status === 'active');
    if (!session || !user || session.expiresAt < now()) {
      return res.status(401).json({ error: 'Session expired.' });
    }

    const nextAccess = signJwt({ sub: user.id, sid: session.id, role: user.role, typ: 'access' }, secret, ACCESS_TTL_SECONDS);
    res.setHeader('Set-Cookie', serializeCookie('apx_at', nextAccess, buildCookieOptions(req, ACCESS_TTL_SECONDS)));
    return res.json({ ok: true, user: publicUser(user) });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const csrf = String(req.headers['x-csrf-token'] || '');
    if (csrf !== auth.cookies.apx_csrf) {
      return res.status(403).json({ error: 'CSRF validation failed.' });
    }
    await invalidateUserSessions(auth.store, auth.user.id);
    res.setHeader('Set-Cookie', [
      serializeCookie('apx_at', '', { ...buildCookieOptions(req, 0), maxAge: 0 }),
      serializeCookie('apx_rt', '', { ...buildCookieOptions(req, 0), maxAge: 0 }),
      serializeCookie('apx_csrf', '', { ...buildCookieOptions(req, 0), maxAge: 0, httpOnly: false }),
    ]);
    return res.json({ ok: true });
  });

  app.post('/api/auth/change-password', async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const csrf = String(req.headers['x-csrf-token'] || '');
    if (csrf !== auth.cookies.apx_csrf) {
      return res.status(403).json({ error: 'CSRF validation failed.' });
    }

    const { oldPassword, newPassword } = req.body || {};
    if (!String(newPassword || '').trim() || String(newPassword || '').trim().length < 10) {
      return res.status(400).json({ error: 'New password must be at least 10 characters.' });
    }

    const ok = await verifyPassword(oldPassword, auth.user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    auth.user.passwordHash = await hashPassword(newPassword);
    await invalidateUserSessions(auth.store, auth.user.id);
    await saveStore(auth.store);
    return res.json({ ok: true });
  });

  app.post('/api/auth/request-password-reset', async (req, res) => {
    const ip = getClientIp(req);
    const { email, captchaToken } = req.body || {};
    const captcha = await verifyRecaptcha(captchaToken, ip);
    if (!captcha.ok) return res.status(400).json({ error: captcha.error });

    const store = await readStore();
    const user = findUserByEmail(store, email);
    if (!user) {
      return res.json({ ok: true, message: 'If the email exists, a reset code has been sent.' });
    }

    const resetCode = createEmailCode();
    user.resetPasswordCodeHash = sha256(resetCode);
    user.resetPasswordExpiresAt = now() + RESET_CODE_TTL_MS;
    await saveStore(store);

    const appName = getEnv('APP_NAME', 'Apexora');
    await sendMail({
      to: user.email,
      subject: `${appName} password reset code`,
      text: `Your password reset code is ${resetCode}. It expires in 20 minutes.`,
      html: `<p>Your password reset code is <strong>${resetCode}</strong>. It expires in 20 minutes.</p>`,
    });

    return res.json({
      ok: true,
      message: 'If the email exists, a reset code has been sent.',
      devResetCode: process.env.NODE_ENV === 'production' ? undefined : resetCode,
    });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body || {};
    const store = await readStore();
    const user = findUserByEmail(store, email);
    const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (!user || !cleanCode || cleanCode.length !== 6) {
      return res.status(400).json({ error: 'Invalid reset request.' });
    }
    if (user.resetPasswordExpiresAt < now() || user.resetPasswordCodeHash !== sha256(cleanCode)) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }
    if (!String(newPassword || '').trim() || String(newPassword || '').trim().length < 10) {
      return res.status(400).json({ error: 'New password must be at least 10 characters.' });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.resetPasswordCodeHash = null;
    user.resetPasswordExpiresAt = null;
    await invalidateUserSessions(store, user.id);
    await saveStore(store);
    return res.json({ ok: true });
  });

  app.post('/api/auth/2fa/setup', async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const secret = authenticator.generateSecret();
    const issuer = getEnv('APP_NAME', 'Apexora');
    const label = `${issuer}:${auth.user.email}`;
    const otpauthUrl = authenticator.keyuri(auth.user.email, issuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, scale: 6 });

    auth.user.twoFactorPendingSecret = secret;
    auth.user.twoFactorSetupExpiresAt = now() + TWO_FACTOR_SETUP_TTL_MS;
    await saveStore(auth.store);

    return res.json({
      ok: true,
      label,
      issuer,
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    });
  });

  app.post('/api/auth/2fa/confirm', async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const { code } = req.body || {};
    const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (!auth.user.twoFactorPendingSecret || auth.user.twoFactorSetupExpiresAt < now()) {
      return res.status(400).json({ error: 'No pending 2FA setup found.' });
    }
    if (!cleanCode || !authenticator.check(cleanCode, auth.user.twoFactorPendingSecret)) {
      return res.status(400).json({ error: 'Invalid authenticator code.' });
    }

    auth.user.twoFactorEnabled = true;
    auth.user.twoFactorSecret = auth.user.twoFactorPendingSecret;
    auth.user.twoFactorPendingSecret = null;
    auth.user.twoFactorSetupExpiresAt = null;
    await saveStore(auth.store);
    return res.json({ ok: true, twoFactorEnabled: true });
  });
};

export { registerAuthRoutes, requireAuth, parseCookies, signJwt, verifyJwt };
