import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Modal: focus-trapped, ESC closes, returns focus on close.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === "Tab" && modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="min-h-screen px-4 text-center flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Dialog */}
        <div
          ref={modalRef}
          className="inline-block w-full max-w-lg my-8 p-6 text-left align-middle transition-all transform bg-[var(--surface)] border border-[var(--border)] shadow-xl rounded-[12px] relative z-10"
        >
          <div className="flex items-start justify-between pb-4 border-b border-[var(--border)]">
            <div>
              <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close modal"
              icon={<X className="w-5 h-5 text-[var(--text-secondary)]" />}
            />
          </div>

          <div className="py-4 text-[16px] text-[var(--text-secondary)]">
            {children}
          </div>

          {footer && (
            <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
