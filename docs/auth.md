# Authentication and roles

Email and password handled by the API, server-side sessions in Postgres. No JWT: a session must be revocable at once (sign out, password change, admin action), and a stateless token is not.

## Flow

- `POST /auth/register`: invitation only, by link token or by email and code (`onboarding.md`). Creates a `PRACTITIONER`, opens a session.
- `POST /auth/login`: same generic error for unknown email and wrong password (`invalid_credentials`), so the form does not reveal who has an account.
- `POST /auth/logout`: deletes the session row and clears the cookie.
- `GET /auth/me`: the current user projection (never the hash), or 401.

## Sessions

- Token: 32 random bytes, base64url. Sent to the browser once, in the cookie `shobukapp_session` (httpOnly, SameSite=Lax, Path=/, `Secure` when `APP_ENV=production`).
- Stored as `sha256(token)` in `sessions.token_hash`: a database dump does not hand out live sessions.
- Lifetime `SESSION_TTL_DAYS` (default 30), sliding: renewed when less than half remains.
- Changing the password deletes every other session of the user.

## Passwords

- argon2id with the library defaults. Minimum 10 characters, no composition rules.
- The hash is selected only in `AuthService`. The user as seen by themself or by an admin goes through `selfUserSelect`, which does not carry it, so a new endpoint cannot leak it by forgetting a `delete`. `selfUserSelect` carries every profile field: never use it to show a user to another member (the directory has its own select, `members.md`).
- Password reset by email is not in the MVP. Until it exists, an admin cannot reset a password either: they would have to know or choose it, which is exactly what we refuse.

## Guards

- `SessionGuard` (global, opt-out with `@Public()`): reads the cookie, resolves the session, sets `req.user`.
- `RolesGuard` (global, after `SessionGuard`): enforces `@Roles('ADMIN')`. Registered in that order in `AppModule`. The first admin routes come with an e2e test checking that each `/admin/*` route answers 403 to a practitioner and 401 to a visitor.
- Rate limit (`@nestjs/throttler`, `AppThrottlerGuard`): 300 requests per minute globally, 10 per minute on register, login and password change. The bucket is keyed on the email in the body, else the session, else the IP.
- Errors carry a stable `code` (`unauthenticated`, `forbidden`, `invalid_credentials`, `email_taken`): the web maps it to a French message, never shows the raw API message.

## Pitfall: client IP behind the web proxy

Every browser request reaches the API through the Next rewrite, so the socket peer is always the Next server. Next 16 rewrites do **not** add `X-Forwarded-For` (httpxy without `xfwd`, see `next/dist/server/lib/router-utils/proxy-request.js`) and pass through one the client sent. So:

- Never set Express `trust proxy` while the rewrite is the only hop: `req.ip` would come from a header the client chooses, and a new value per request escapes every limit.
- Without it, every visitor has the same IP. That is why `AppThrottlerGuard` keys on the email for auth routes (password guessing is capped per account whatever the IP) and on the session otherwise. Trade off: someone can slow down a victim's login for a minute by failing ten times on their email.
- In production behind a real reverse proxy that overwrites `X-Forwarded-For` (Traefik), trust exactly that hop, never `true`.

## Admin right

`pnpm --filter @shobukapp/api admin:grant <email>` sets `role = ADMIN`. No HTTP route changes a role. Requires server access, which is the point.

## Web side

The `(app)` and `(admin)` layouts call `/auth/me` server-side and redirect, which avoids flashing empty screens. A layout redirect does not protect its page: every protected page checks the user itself (`docs/architecture.md`, Protecting a page). The API remains the only authority.
