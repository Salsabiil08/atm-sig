/**
 * Responsive ATM wordmark (no checklist icon).
 * Uses currentColor so dark backgrounds get a white mark while light
 * backgrounds get a near-black mark. Red chevron stays consistent.
 */
type ATMWordmarkProps = {
  variant?: 'dark' | 'light'
  showSubtitle?: boolean
  className?: string
}

export default function ATMWordmark({
  variant = 'dark',
  showSubtitle = false,
  className = '',
}: ATMWordmarkProps) {
  return (
    <span
      className={`inline-flex max-w-full flex-col items-center ${variant === 'light' ? 'text-white' : 'text-[#0B0F0D]'} ${className}`}
      role="img"
      aria-label="ATM — Accounting Task Manager"
    >
      <svg
        viewBox="0 0 480 105"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        aria-hidden="true"
        className="block h-auto w-full"
      >
        {/* Geometric A, T and M: typography only, with the brand's red A accent. */}
        <path
          d="M12 88 78 15C84 8 96 8 102 15L168 88C174 95 169 101 160 101H145C141 101 138 100 135 96L90 43 45 96C42 100 39 101 35 101H20C11 101 6 95 12 88Z"
          fill="currentColor"
        />
        <path d="M62 96 88 68C89 66 92 66 94 68L119 96C122 99 119 101 115 101H101L91 90 81 101H66C62 101 59 99 62 96Z" fill="#E82735" />
        <path
          d="M177 12H291C299 12 301 18 297 24L287 37C285 40 282 41 278 41H249V91C249 98 246 101 239 101H229C222 101 219 98 219 91V41H190C186 41 183 40 181 37L171 24C167 18 169 12 177 12Z"
          fill="currentColor"
        />
        <path
          d="M313 101C305 101 302 98 302 90V27C302 14 309 11 319 11H327C331 11 334 13 337 16L390 67 440 16C443 13 446 11 450 11H457C468 11 474 17 474 27V90C474 98 471 101 463 101H453C446 101 443 98 443 91V49L403 91C396 98 386 98 379 91L333 49V91C333 98 330 101 323 101H313Z"
          fill="currentColor"
        />
      </svg>
      {showSubtitle && (
        <span className="mt-1 whitespace-nowrap text-center text-[clamp(0.7rem,2.3vw,1rem)] font-medium tracking-tight">
          Accounting Task Manager
        </span>
      )}
    </span>
  )
}
