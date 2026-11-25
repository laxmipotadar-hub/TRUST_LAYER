import React from "react";
import { AnalysisProvider } from "../context/AnalysisContext";

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AnalysisProvider>{children}</AnalysisProvider>;
};
