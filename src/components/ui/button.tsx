import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink min-h-11 px-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-ink/90",
        primary: "bg-pine text-white hover:bg-pine/90",
        outline: "bg-surface text-ink shadow-[var(--shadow-border)] hover:bg-paper",
        soft: "bg-paper-2 text-ink hover:bg-border",
        ghost: "bg-transparent text-ink hover:bg-paper-2",
        danger: "bg-brick text-white hover:bg-brick/90",
        dangerSoft: "bg-brick-2 text-brick hover:bg-brick-2/70",
      },
      size: {
        default: "h-12",
        sm: "min-h-11 px-3 text-sm",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: Props) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
