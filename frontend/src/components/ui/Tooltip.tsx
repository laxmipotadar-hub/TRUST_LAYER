import React, { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

export interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Tooltip: a small '?' icon button that shows text on hover AND keyboard focus.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ml-1 ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label="Help explanation"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-[var(--text-muted)] hover:text-[var(--brand-steel)] focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)] rounded-full p-0.5 cursor-help transition-colors select-none"
      >
        {children || <HelpCircle className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[var(--text-primary)] text-white text-[14px] leading-relaxed rounded-lg shadow-lg z-50 pointer-events-none transition-opacity duration-150"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
        </div>
      )}
    </span>
  );
};
