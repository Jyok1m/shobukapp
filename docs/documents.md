# Documents and licences

## Storage

- `StorageService` has two methods that matter: `put(key, stream, mime)` and `get(key)`. MVP driver: local disk under `STORAGE_DIR` (git-ignored). Production driver: S3 compatible (OVH Object Storage or similar), same interface, chosen by configuration.
- Keys are random uuids, never the original filename: a filename carries personal data and path tricks.
- No public URL, no presigned URL in the MVP. Every download goes through an API route that checks ownership or role, then streams with `Content-Disposition: attachment` and the stored mime type.
- Upload limits: 10 MB, PDF, JPEG, PNG, WebP. The mime type is checked from the file's magic bytes, not trusted from the browser.

## Member documents ("Mes documents")

- `GET /documents`, `POST /documents` (multipart), `PATCH /documents/:id` (title, valid until), `DELETE /documents/:id`, `GET /documents/:id/file`.
- Only the owner and admins can read a member document. A practitioner asking for someone else's document gets 404, not 403: no existence oracle.
- `MEDICAL_CERTIFICATE` carries `valid_until`. The admin list shows missing or expired certificates.
- Deleting a document deletes the stored file, then the row.

## Dojo documents ("Documents du dojo", admin)

- Same table with `owner_id = null` and category `LEGAL`, `ACCOUNTING` or `OTHER`.
- `/admin/documents` CRUD, admins only. Open question: should practitioners read legal documents (statuts, règlement intérieur)? Likely yes, through a `shared_with_members` flag; not in the MVP.

## FFK licences

- One row per user and season (`unique(user_id, season)`), uploaded by an admin with the licence number and the PDF.
- `GET /licenses` for the member, `GET /licenses/:id/file`; `/admin/licenses` CRUD for admins.
- Re-uploading for the same season replaces the file and keeps the row.
- The legal information needed to request a licence comes from the profile (`members.md`). Generating the FFK request automatically is out of scope.
