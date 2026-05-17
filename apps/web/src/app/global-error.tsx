"use client"

import { useEffect } from "react"
import Link from "next/link"

type GlobalErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-[100dvh] items-center justify-center bg-brand-bg px-6 py-16 text-brand-text">
          <section className="flex max-w-xl flex-col items-center text-center">
            <p className="font-serif text-8xl font-semibold leading-none text-[color:var(--color-brand-accent)] md:text-9xl">
              500
            </p>
            <h1 className="mt-6 text-3xl font-semibold md:text-4xl">Algo deu errado</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-brand-muted">
              Tivemos um problema ao processar sua solicitação. Tente novamente.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--color-brand-border)] bg-[color:var(--color-brand-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-brand-accent-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Voltar para o início
              </Link>
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--color-brand-border)] bg-transparent px-5 text-sm font-medium text-brand-text transition-colors hover:bg-[color:var(--color-brand-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Tentar novamente
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
