# Authentication and roles

Email and password handled by the API, server-side sessions in Postgres. No JWT: a session must be revocable at once (sign out, password change, admin action), and a stateless token is not.

## Flow

- `POST /auth/register` (email, password, first name, last name, consent to terms): creates a `PRACTITIONER`, opens a session.
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
- The hash is selected only in `AuthService`. Every other query uses a shared `publicUserSelect` that does not carry it, so a new endpoint cannot leak it by forgetting a `delete`.
- Password reset by email is not in the MVP. Until it exists, an admin cannot reset a password either: they would have to know or choose it, which is exactly what we refuse.

## Guards

- `SessionGuard` (global, opt-out with `@Public()`): reads the cookie, resolves the session, sets `req.user`.
- `RolesGuard` (global, after `SessionGuard`): enforces `@Roles('ADMIN')`. Registered in that order in `AppModule`; an e2e test checks that every `/admin/*` route answers 403 to a practitioner and 401 to a visitor.
- Rate limit on `/auth/login` and `/auth/register` (`@nestjs/throttler`), to slow down password guessing.

## Admin right

`pnpm --filter @shobukapp/api admin:grant <email>` sets `role = ADMIN`. No HTTP route changes a role. Requires server access, which is the point.

## Web side

The `(app)` and `(admin)` layouts call `/auth/me` server-side and redirect. That avoids flashing empty screens; the API remains the only authority.
