# Messaging

1:1 messages between signed-in users. No groups, no attachments, no real time in the MVP.

- `GET /messages/conversations`: one entry per counterpart, last message and unread count, ordered by last activity.
- `GET /messages/with/:userId?cursor=`: messages between the current user and that user, newest first, cursor pagination.
- `POST /messages { recipientId, body }`: body trimmed, 1 to 2000 characters, plain text (rendered as text, never as HTML).
- `POST /messages/with/:userId/read`: marks received messages as read.
- A practitioner can write to anyone listed in the directory and to any admin. Admins can write to anyone.
- The web polls every 15 seconds on the open conversation and every 60 seconds for the unread badge. Server-sent events or websockets are a later step, once polling shows its limits.
- Messages are personal data: they are deleted with their sender's account (`privacy.md`).
