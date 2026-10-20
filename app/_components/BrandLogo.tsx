import Image from 'next/image'

type BrandLogoProps = {
  className?: string
  priority?: boolean
}

export default function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/atm-logo.png"
      alt="ATM — Accounting Task Manager"
      width={1266}
      height={1111}
      priority={priority}
      className={className}
    />
  )
}
