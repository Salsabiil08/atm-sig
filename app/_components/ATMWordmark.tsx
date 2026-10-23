/**
 * ATM artwork traced from the original wordmark supplied by the project owner
 * (white-background ATM logo, 23 October 2026), not a substitute font/icon.
 * For red/dark surfaces: white letters with BLACK chevron for contrast.
 * For white/light surfaces: near-black letters with original logo red chevron.
 */
type ATMWordmarkProps = {
  variant?: 'dark' | 'light'
  showSubtitle?: boolean
  className?: string
}

const LETTER_PATHS = [
  'M682 34L681 41L680 42L680 210L683 216L688 219L742 219L744 218L749 212L749 102L750 101L749 88L750 87L758 93L774 109L775 109L859 191L870 200L872 200L877 203L880 203L881 204L898 204L899 203L902 203L912 198L934 177L935 177L975 138L976 138L976 137L995 119L996 119L1030 87L1031 88L1031 211L1032 214L1038 219L1092 219L1094 218L1099 212L1099 29L1093 17L1088 12L1079 7L1075 7L1074 6L1035 6L1021 11L1015 15L1003 27L1002 27L985 44L984 44L892 131L890 131L876 117L875 117L773 17L762 10L760 10L757 8L750 7L749 6L716 6L715 7L712 7L706 10L704 10L696 15L688 23Z',
  'M335 14L336 20L338 22L340 27L350 43L358 53L365 58L372 59L373 60L468 60L469 61L469 211L470 214L473 217L477 219L531 219L535 217L539 211L539 61L540 60L632 60L633 59L636 59L643 56L651 48L663 29L668 18L668 13L667 11L664 8L659 6L343 6L339 8L336 11Z',
  'M6 216L7 219L86 219L89 218L112 193L137 163L190 104L217 72L223 66L226 66L228 67L237 77L243 85L271 116L277 124L279 125L291 140L299 148L316 169L328 182L333 189L359 218L362 219L443 219L445 217L433 202L431 201L426 194L419 187L380 141L327 81L322 74L285 32L285 31L269 16L259 11L250 8L237 7L236 6L212 6L211 7L203 7L202 8L199 8L183 14L181 16L176 18L170 23L146 50L132 68L120 81L94 113L82 126L77 133L59 153L54 160L48 166L38 179L31 186Z',
]
const ACCENT_PATH = 'M134 217L135 219L199 219L201 218L214 202L225 191L241 208L247 216L251 219L316 219L317 217L301 200L301 199L265 159L265 158L227 117L223 117L221 119L221 120L200 142L186 159L178 167L171 176L168 178L168 179Z'

export default function ATMWordmark({
  variant = 'dark',
  showSubtitle = false,
  className = '',
}: ATMWordmarkProps) {
  const light = variant === 'light'
  return (
    <span
      className={`inline-flex max-w-full flex-col items-center ${light ? 'text-white' : 'text-[#0D0F0C]'} ${className}`}
      role="img"
      aria-label="ATM — Accounting Task Manager"
    >
      <svg
        viewBox="0 0 1106 226"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        aria-hidden="true"
        className="block h-auto w-full"
      >
        {LETTER_PATHS.map((path, index) => (
          <path key={index} d={path} fill="currentColor" />
        ))}
        <path d={ACCENT_PATH} fill={light ? '#0D0F0C' : '#EB232D'} />
      </svg>
      {showSubtitle && (
        <span className="mt-1 whitespace-nowrap text-center text-[clamp(0.7rem,2.3vw,1rem)] font-medium tracking-tight">
          Accounting Task Manager
        </span>
      )}
    </span>
  )
}
