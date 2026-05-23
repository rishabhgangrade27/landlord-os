/**
 * LinkButton — a Next.js Link styled as a Button.
 * Use this wherever you previously used <Button asChild><Link href="...">
 * shadcn v4 uses @base-ui/react which doesn't have an asChild prop.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { VariantProps } from 'class-variance-authority'

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string
  className?: string
  children: React.ReactNode
}

export function LinkButton({
  href,
  variant = 'default',
  size = 'default',
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  )
}
