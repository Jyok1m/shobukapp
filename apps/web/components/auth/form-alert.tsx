export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}
