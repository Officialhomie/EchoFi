import * as React from "react"
import { clsx } from "clsx"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={clsx(
          // Base styles
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
          
          // Variants
          {
            // Default
            "bg-blue-600 text-white hover:bg-blue-700": variant === 'default',
            
            // Destructive
            "bg-red-600 text-white hover:bg-red-700": variant === 'destructive',
            
            // Outline
            "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50": variant === 'outline',
            
            // Secondary
            "bg-gray-100 text-gray-900 hover:bg-gray-200": variant === 'secondary',
            
            // Ghost
            "hover:bg-gray-100 text-gray-900": variant === 'ghost',
            
            // Link
            "underline-offset-4 hover:underline text-blue-600": variant === 'link',
          },
          
          // Sizes
          {
            "h-10 py-2 px-4": size === 'default',
            "h-9 px-3 rounded-md": size === 'sm',
            "h-11 px-8 rounded-md": size === 'lg',
            "h-10 w-10": size === 'icon',
          },
          
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }