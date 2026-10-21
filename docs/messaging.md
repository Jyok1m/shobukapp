# Messaging

1:1 messages between signed-in users. No groups, no attachments, no real time in the MVP.

- `GET /messages/conversations`: one entry per counterpart, last message and unread count, ordered by last activity.
- `GET /messages/with/:userId?cursor=`: messages between the current user and that user, newest first, cursor pagination, plus `counterpart` and `canWrite`.
- `GET /messages/unread-count`: for the navigation badge.
- `POST /messages { recipientId, body }`: body trimmed, 1 to 2000 characters, plain text (rendered as text, never as HTML).
- `POST /messages/with/:userId/read`: marks received messages as read.
- A practitioner can write to anyone listed in the directory, to any admin, and can always answer someone who wrote to them. Admins can write to anyone. Anything else answers 404 (`member_not_found`), like an unknown id. Reading a thread with someone you cannot write to and never exchanged with also answers 404: an unlisted member's name must not leak through a guessed id.
- A counterpart is shown with first name, last name, `isAdmin` and `hasPhoto` only: never email or phone (those belong to the directory projection, for listed members).
- Conversations are built from the 1000 most recent messages of the user: enough for a dojo, to revisit with a dedicated query if it grows.
- The web polls every 15 seconds on the open conversation, every 30 seconds for the conversation list and every 60 seconds for the unread badge, paused while the tab is hidden. `?avec=` is used only if it is a uuid: it ends up in `/api` paths. Server-sent events or websockets are a later step, once polling shows its limits.
- Messages are personal data: they are deleted with their sender's account (`privacy.md`).
