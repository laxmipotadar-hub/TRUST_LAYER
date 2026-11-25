import React from "react";
import { ArchitectureDiagram } from "../features/deployment/ArchitectureDiagram";

export const DeploymentPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <ArchitectureDiagram />
    </div>
  );
};
