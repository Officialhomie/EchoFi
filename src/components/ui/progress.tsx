import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva(
  "relative h-4 w-full overflow-hidden rounded-full bg-gray-100",
  {
    variants: {
      variant: {
        default: "bg-gray-100",
        primary: "bg-blue-100",
        success: "bg-green-100",
        warning: "bg-yellow-100",
        destructive: "bg-red-100",
      },
      size: {
        default: "h-4",
        sm: "h-2",
        lg: "h-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const progressIndicatorVariants = cva(
  "h-full w-full flex-1 transition-all",
  {
    variants: {
      variant: {
        default: "bg-gray-600",
        primary: "bg-blue-600",
        success: "bg-green-600",
        warning: "bg-yellow-600",
        destructive: "bg-red-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  showValue?: boolean;
  valueLabel?: string;
  className?: string;
  value?: number;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant, size, showValue, valueLabel, ...props }, ref) => (
  <div className="relative">
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(progressVariants({ variant, size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(progressIndicatorVariants({ variant }))}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
    {showValue && (
      <div className="mt-1 text-sm text-gray-600">
        {valueLabel || `${Math.round(value || 0)}%`}
      </div>
    )}
  </div>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress, progressVariants, progressIndicatorVariants };
