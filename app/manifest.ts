import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Accounting Task Manager',
    short_name: 'ATM',
    description: 'Task management Department of Accounting',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#b91c1c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
