import React from "react";
import { useTheme } from "../../context/ThemeContext";

// Define os tipos das props
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, id, error = false, className = "", ...props }) => {
  const { primary, foregroundColor } = useTheme();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900" style={{ color: foregroundColor }}>
        {label}
      </label>
      <div className="mt-1">
        <input
          id={id}
          aria-invalid={error || undefined}
          {...props}
          className={`w-full px-3 py-[6.4px] border rounded-md shadow-sm transition-all duration-200 focus-within:ring-1 focus-within:ring-(--theme-primary) focus-within:border-(--theme-primary) hover:border-(--theme-primary) ${
            error ? "border-red-500 ring-1 ring-red-500 focus:border-red-500" : "border-gray-300"
          } ${className}`}
          style={
            {
              "--theme-primary": primary,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
};
