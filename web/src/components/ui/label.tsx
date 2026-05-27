import { cn } from '@/lib/ui/cn'

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-medium text-slate-700', className)}
      {...props}
    />
  )
}

