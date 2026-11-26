import React from "react";
import { Wifi } from "lucide-react";

export interface PhoneFrameProps {
  roleLabel: string;
  tone?: "caller" | "agent";
  compact?: boolean;
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  roleLabel,
  tone = "caller",
  compact = false,
  children,
}) => {
  const screenGradient =
    tone === "caller"
      ? "bg-gradient-to-b from-[#0b132b] via-[#121e3d] to-[#0f172a] text-white"
      : "bg-gradient-to-b from-[#0f172a] via-[#132038] to-[#111827] text-white";

  return (
    <div
      data-testid={`phone-frame-${tone}`}
      className={`mx-auto w-full ${
        compact ? "max-w-[184px] rounded-[24px] p-1.5" : "max-w-[336px] rounded-[34px] p-2.5"
      } bg-[#0b101d] border-2 border-[#2a3856] shadow-xl select-none`}
    >
      <div
        className={`relative overflow-hidden flex flex-col justify-between ${
          compact ? "rounded-[18px] min-h-[380px]" : "rounded-[26px] min-h-[540px]"
        } ${screenGradient}`}
      >
        {/* Top status bar with SVG signal + Wi-Fi + battery */}
        <div
          className={`flex items-center justify-between ${
            compact ? "px-2.5 pt-1.5 pb-1 text-[11px]" : "px-4 pt-2.5 pb-1.5 text-[14px]"
          } font-semibold text-white/90`}
        >
          <span>9:41</span>
          <div
            aria-hidden="true"
            className={`${compact ? "w-10 h-2.5" : "w-16 h-3.5"} rounded-full bg-black/80 border border-white/10`}
          />
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <svg
              width={compact ? 11 : 14}
              height={compact ? 10 : 12}
              viewBox="0 0 14 12"
              fill="none"
              className="text-white"
            >
              <rect x="0.5" y="8" width="2.2" height="3.5" rx="0.6" fill="currentColor" />
              <rect x="4" y="5.5" width="2.2" height="6" rx="0.6" fill="currentColor" />
              <rect x="7.5" y="3" width="2.2" height="8.5" rx="0.6" fill="currentColor" />
              <rect x="11" y="0.5" width="2.2" height="11" rx="0.6" fill="currentColor" />
            </svg>
            <Wifi className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            <svg
              width={compact ? 15 : 20}
              height={compact ? 9 : 11}
              viewBox="0 0 20 11"
              fill="none"
              className="text-white"
            >
              <rect x="0.75" y="1" width="16" height="9" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2.5" y="2.8" width="12.5" height="5.4" rx="1" fill="#34d399" />
              <rect x="17.5" y="3.5" width="1.8" height="4" rx="0.8" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Role label pill */}
        <div className="px-3 pb-1 flex justify-center">
          <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold tracking-wide text-white/90 uppercase">
            {roleLabel}
          </span>
        </div>

        {/* Main Screen Body */}
        <div className={`flex-1 flex flex-col ${compact ? "px-2.5 py-2" : "px-4 py-3"}`}>
          {children}
        </div>

        {/* Bottom Home Indicator */}
        <div className="pb-2 pt-1 flex justify-center" aria-hidden="true">
          <div className={`${compact ? "w-16" : "w-28"} h-1 rounded-full bg-white/40`} />
        </div>
      </div>
    </div>
  );
};
