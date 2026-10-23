import type { ReactNode } from 'react'
import ATMWordmark from '@/app/_components/ATMWordmark'
import ThemeToggle from '@/app/_components/ThemeToggle'

type Props = {
  title: string
  description: string
  children: ReactNode
}

export default function AuthPageShell({ title, description, children }: Props) {
  return (
    <main className="atm-login-page relative flex min-h-dvh w-full items-center justify-center bg-white px-4 py-20 sm:px-8 sm:py-10">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-6">
        <ThemeToggle />
      </div>
      <section
        aria-labelledby="auth-heading"
        className="atm-login-card mx-auto w-full max-w-[420px] rounded-2xl border border-red-100 bg-white px-5 py-7 shadow-sm sm:max-w-[460px] sm:px-10 sm:py-11"
      >
        <div className="mb-5 flex justify-center sm:mb-7">
          <ATMWordmark variant="dark" showSubtitle className="w-[min(62vw,205px)] sm:w-[210px]" />
        </div>
        <h1 id="auth-heading" className="text-center text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mb-6 mt-2 text-center text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        {children}
      </section>
    </main>
  )
}
