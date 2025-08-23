import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./loading-spinner";

const securityButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "btn-security text-white hover:scale-105",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      size: {
        sm: "h-9 px-4 py-2",
        md: "h-11 px-6 py-3", 
        lg: "h-12 px-8 py-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface SecurityButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof securityButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const SecurityButton = React.forwardRef<HTMLButtonElement, SecurityButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(securityButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <LoadingSpinner size="sm" className="mr-2" />}
        {children}
      </Comp>
    );
  }
);

SecurityButton.displayName = "SecurityButton";

export { SecurityButton, securityButtonVariants };