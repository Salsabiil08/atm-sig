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
    <main className="atm-login-page flex min-h-dvh w-full flex-col bg-white px-5 pb-6 pt-3 sm:relative sm:items-center sm:justify-center sm:px-8 sm:py-10">
      <div className="flex w-full shrink-0 justify-end sm:absolute sm:right-8 sm:top-6 sm:w-auto">
        <ThemeToggle />
      </div>
      <section
        aria-labelledby="auth-heading"
        className="atm-login-card mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center bg-white py-5 sm:flex-none sm:rounded-2xl sm:border sm:border-red-100 sm:px-10 sm:py-11 sm:shadow-sm"
      >
        <div className="mb-7 flex justify-center">
          <ATMWordmark variant="dark" showSubtitle className="w-[min(70vw,245px)] sm:w-[210px]" />
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
