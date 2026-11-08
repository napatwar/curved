import type { ReactNode } from "react";

/** Centers a small card, for sign-in and other screens outside a workspace. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
