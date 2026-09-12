import type { HTMLAttributes } from 'react'
import { cn } from '../../design/cn'

type VaultPageProps = HTMLAttributes<HTMLDivElement>

export function VaultPage({ className, ...rest }: VaultPageProps) {
  return <div className={cn('vault-page', className)} {...rest} />
}