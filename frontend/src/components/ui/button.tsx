import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#1D1D1F] text-white hover:bg-[#3a3a3c] focus-visible:ring-[#1D1D1F]",
        outline:
          "border-[#D1D1D6] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] focus-visible:ring-[#1D1D1F]",
        secondary:
          "bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] focus-visible:ring-[#1D1D1F]",
        ghost:
          "text-[#1D1D1F] hover:bg-[#F5F5F7] focus-visible:ring-[#1D1D1F]",
        destructive:
          "bg-red-50 text-red-600 hover:bg-red-100 focus-visible:ring-red-500",
        link: "text-[#0071E3] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-6 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 rounded-md px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 rounded-xl px-6 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-7 rounded-md",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
