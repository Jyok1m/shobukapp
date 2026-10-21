# Onboarding: join requests and invitations

Nobody signs up on their own. An account is always created from an invitation, which an admin issues in one of two ways.

## Future practitioners: join request, then link

1. `/nous-rejoindre` (public): first name, last name, email, optional phone, a message, and "Je souhaite faire un cours d'essai". `POST /join-requests` stores a `join_requests` row (status `NEW`), acknowledges by mail to the requester and notifies every admin by mail.
2. The admin reads it in `/admin/demandes`. Either declines (`PATCH /admin/join-requests/:id {status: 'DECLINED'}`, reversible to `NEW`), deletes it (GDPR), or sends a link: `POST /admin/join-requests/:id/invite` creates a `LINK` invitation, mails `${WEB_URL}/inscription?invitation=<token>` and returns the link to the admin too, so it can be handed over if the mail does not arrive.
3. `/inscription?invitation=<token>` prefills from `GET /auth/invitations/:token` (email, names). `POST /auth/register {token, password, firstName, lastName, acceptTerms}` creates the account **with the invitation's email**: a link never comes with an email (refused if it does).

Sending a link again revokes the previous one: only the latest works.

## Existing practitioners: email and code

1. The admin creates a code in `/admin/invitations` (`POST /admin/invitations {firstName, lastName, email}`). It is mailed and shown **once** to the admin (format `XXXX-XXXX`, Crockford base32, no I/L/O/U), never stored in clear. Creating a new code for the same address revokes the previous pending ones.
2. On `/connexion`, "Je suis déjà pratiquant mais je n'ai pas encore de compte" leads to `/activation`: email, code, names, password. `POST /auth/register {email, code, ...}`. Input is normalised (case, spaces, dash, O read as 0, I and L as 1).

## Rules

- Every failure answers `invalid_invitation`: unknown token, wrong code, code for another address, expired, used, revoked or locked. No oracle on which one.
- A wrong code increments `failed_attempts` on every pending code of that address; at 5 the code is `LOCKED` and the admin issues a new one. With 40 bits per code, plus the per-email throttle (10 per minute on register), guessing is out of reach.
- The invitation is claimed atomically (`updateMany ... where used_at is null and not expired`) in the same transaction as the user creation: two submissions of one link cannot both win, and a failed creation releases nothing.
- Invitations expire after 14 days. An address that already has an account cannot be invited (`email_taken`).
- Tokens and codes are stored as SHA-256 hashes. Links are 32 random bytes; codes are short by design, so their safety rests on the lockout and expiry, not on the hash.
- `POST /join-requests` is public: throttled to 5 per hour per email, and a hidden `website` field (honeypot) makes a bot's submission answer 202 without being stored. The answer is the same in every case.
- Mail failures never fail a request: the row is stored and the dashboard shows it.
- Join requests are personal data of people who are not members: retention to decide with the dojo (`privacy.md`).

Login itself is unchanged: email and password (`auth.md`).
