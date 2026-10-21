-- Run on the freshly restored copy (shobukapp_import on the dev server), before
-- it replaces the dev database. One transaction: a failure leaves the copy
-- unswapped and the script stops (docs/deployment.md, Production to dev).
--
-- Admins keep their email and role, to sign in on dev and recognise their
-- account; everything else about them is cleared like for anyone. Everyone
-- else becomes "Membre n" on a reserved domain (no mail can reach a real
-- person). Every account, admins included, gets the demo password
-- `shobukan-demo`: production hashes never reach the dev host.

BEGIN;

UPDATE users u SET
  first_name = CASE WHEN u.role = 'ADMIN' THEN 'Admin' ELSE 'Membre' END,
  last_name = lpad(n.rn::text, 3, '0'),
  email = CASE WHEN u.role = 'ADMIN' THEN u.email ELSE 'membre-' || n.rn || '@anonyme.invalid' END,
  password_hash = '$argon2id$v=19$m=65536,p=4,t=3$/wgULPGlOuprmRCGyKR/MQ$8dzbQkrjYgryUtWI/T3xTJqnvWhYRksGGEsL8c/eDG0',
  phone = NULL,
  photo_key = NULL,
  birth_date = NULL,
  sex = NULL,
  nationality = NULL,
  address_line = NULL,
  postal_code = NULL,
  city = NULL,
  country = NULL,
  emergency_contact_name = NULL,
  emergency_contact_phone = NULL,
  must_change_password = false
FROM (
  SELECT id, row_number() OVER (PARTITION BY role ORDER BY created_at, id) AS rn
  FROM users
) n
WHERE u.id = n.id;

-- Production Stripe objects mean nothing to the dev keys, live ones even less.
UPDATE users SET stripe_test_customer_id = NULL, stripe_live_customer_id = NULL;
UPDATE plans SET stripe_test_product_id = NULL, stripe_test_price_id = NULL,
  stripe_live_product_id = NULL, stripe_live_price_id = NULL;
UPDATE subscriptions SET stripe_subscription_id = 'sub_anon_' || id;
UPDATE payments SET stripe_invoice_id = 'in_anon_' || id;
DELETE FROM stripe_events;
UPDATE app_settings SET stripe_live = false, updated_by_id = NULL;

-- A production session or a pending signup link would otherwise work on dev.
DELETE FROM sessions;
DELETE FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL;
UPDATE invitations SET email = 'invite-' || id || '@anonyme.invalid',
  first_name = 'Invité', last_name = 'Anonyme';

UPDATE join_requests SET
  first_name = 'Demande',
  last_name = left(id::text, 8),
  email = 'demande-' || id || '@anonyme.invalid',
  phone = NULL,
  message = 'Message anonymisé.';

UPDATE messages SET body = 'Message anonymisé.';
UPDATE payment_reminders SET note = NULL;

-- Files are not copied: downloads answer 404 on dev. Members' rows keep their
-- dates (useful to test the certificate column) but not the admins': with
-- their email kept, a certificate date would stay tied to a real person.
UPDATE documents SET title = 'Document anonymisé' WHERE owner_id IS NOT NULL;
DELETE FROM documents d USING users u
  WHERE d.owner_id = u.id AND u.role = 'ADMIN';
UPDATE licenses SET number = 'ANON-' || left(id::text, 8);

COMMIT;
