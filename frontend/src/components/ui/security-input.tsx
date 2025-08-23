import * as React from "react";
import { cn } from "@/lib/utils";

export interface SecurityInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

const SecurityInput = React.forwardRef<HTMLInputElement, SecurityInputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "security-input",
            icon && "pl-10",
            error && "border-destructive focus:ring-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

SecurityInput.displayName = "SecurityInput";

export { SecurityInput };