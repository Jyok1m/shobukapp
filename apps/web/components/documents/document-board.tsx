import { formatBytes } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import type { DocumentBoard, MemberDocument } from "@/lib/types";

function DownloadLink({ document }: { document: MemberDocument }) {
  return (
    <a
      href={`/api/documents/${document.id}/file`}
      download
      className="inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline sm:min-h-0"
      aria-label={`Télécharger ${document.title} (${formatBytes(document.sizeBytes)})`}
    >
      Télécharger
      <span className="ml-1 text-xs font-normal text-muted">({formatBytes(document.sizeBytes)})</span>
    </a>
  );
}

/* Dojo documents published by the bureau. A section with nothing in it is not shown. */
export function DocumentBoardSections({ board }: { board: DocumentBoard }) {
  const announcements = [...board.announcements].sort((a, b) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
  );
  return (
    <>
      {announcements.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="announcements-title">
          <h2 id="announcements-title" className="font-serif text-xl font-semibold text-ink">
            Panneau d&apos;annonces
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {announcements.map((document) => (
              <li key={document.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
                <p className="text-xs text-muted">Publié le {formatDate(document.publishedAt ?? document.createdAt)}</p>
                <h3 className="font-serif text-lg font-semibold break-words text-ink">{document.title}</h3>
                {document.description && (
                  <p className="text-sm break-words whitespace-pre-line text-ink">{document.description}</p>
                )}
                <div className="mt-auto pt-1">
                  <DownloadLink document={document} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {board.important.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="important-title">
          <h2 id="important-title" className="font-serif text-xl font-semibold text-ink">
            Documents importants
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {board.important.map((document) => (
              <li key={document.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium break-words text-ink">{document.title}</p>
                  {document.description && <p className="text-sm break-words whitespace-pre-line text-muted">{document.description}</p>}
                </div>
                <DownloadLink document={document} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
