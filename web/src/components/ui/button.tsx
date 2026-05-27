import { cn } from '@/lib/ui/cn'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60'
  const styles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'

  return <button className={cn(base, styles, className)} {...props} />
}

