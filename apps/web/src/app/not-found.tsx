import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-brand-bg px-6 py-16 text-brand-text">
      <section className="flex max-w-xl flex-col items-center text-center">
        <p className="font-serif text-8xl font-semibold leading-none text-[color:var(--color-brand-accent)] md:text-9xl">
          404
        </p>
        <h1 className="mt-6 text-3xl font-semibold md:text-4xl">Página não encontrada</h1>
        <p className="mt-4 max-w-md text-base leading-7 text-brand-muted">
          O link que você seguiu pode estar quebrado ou a página foi removida.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-brand-accent-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Voltar para o início
        </Link>
      </section>
    </main>
  )
}
