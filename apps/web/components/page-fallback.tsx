export function PageFallback() {
  return (
    <div className="flex items-center justify-center p-10" aria-busy>
      <span className="sr-only">Chargement</span>
      <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}
