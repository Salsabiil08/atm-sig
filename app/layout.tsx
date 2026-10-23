import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import PwaRegistration from '@/components/pwa-registration'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    template: '%s | ATM — Accounting Task Manager',
    default: 'ATM — Accounting Task Manager',
  },
  description: 'Sistem manajemen task Department of Accounting PT Semen Indonesia Group',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=localStorage.getItem('atm-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()" }} />
      </head>
      <body className="h-full bg-gray-50 text-gray-900 antialiased">
        <PwaRegistration />
        {children}
      </body>
    </html>
  )
}
