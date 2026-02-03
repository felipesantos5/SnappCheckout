import React from "react";
import { useTheme } from "../../context/ThemeContext";

// Define os tipos das props
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
  const { primary, textColor } = useTheme();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900" style={{ color: textColor }}>
        {label}
      </label>
      <div className="mt-1">
        <input
          id={id}
          {...props}
          className="w-full px-3 py-[6.4px] border border-gray-300 rounded-md shadow-sm transition-all duration-200 focus-within:ring-1 focus-within:ring-(--theme-primary) focus-within:border-(--theme-primary) hover:border-(--theme-primary)"
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
