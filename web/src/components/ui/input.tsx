import { cn } from '@/lib/ui/cn'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}

