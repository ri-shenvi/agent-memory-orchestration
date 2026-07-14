import { ActionLink } from "@memory-debugger/ui";

export default function HomePage(): React.ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-10 shadow-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-sky-400">
          Developer tooling foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Memory Orchestration Debugger
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          Configure, test, and inspect how AI agents retrieve, update, and
          explain memory.
        </p>
        <div className="mt-8">
          <ActionLink href="/api/health">Check system health</ActionLink>
        </div>
      </section>
    </main>
  );
}
