import Login from "@/views/Login";

function pickRedirect(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/** Server reads `?redirect=` so the client form does not need `useSearchParams` (fewer RSC/streaming edge cases). */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <Login initialRedirect={pickRedirect(searchParams.redirect)} />;
}