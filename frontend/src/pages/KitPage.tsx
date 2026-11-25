import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ModeBadge } from "../components/ui/ModeBadge";
import { StatusChip } from "../components/ui/StatusChip";
import { Banner } from "../components/ui/Banner";
import { Tooltip } from "../components/ui/Tooltip";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Drawer } from "../components/ui/Drawer";
import { Modal } from "../components/ui/Modal";
import { StepIndicator } from "../components/ui/StepIndicator";
import { Sparkles } from "lucide-react";

export const KitPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2);
  const [buttonLoading, setButtonLoading] = useState(false);

  return (
    <div className="space-y-10 pb-12">
      <div>
        <h1 className="page-title">AEGIS Design System Review (/kit)</h1>
        <p className="body-text mt-1">
          Review of all light-theme tokens, interactive components, focus states, and WCAG contrast.
        </p>
      </div>

      {/* 1. Step Indicator */}
      <section className="space-y-3">
        <h2 className="section-title">1. Step Indicator (Current, Done, Upcoming)</h2>
        <StepIndicator
          currentStep={activeStep}
          onSelectStep={(s) => setActiveStep(s)}
        />
        <p className="caption-text">Click a step above to toggle current / done / upcoming states.</p>
      </section>

      {/* 2. Buttons */}
      <section className="space-y-4">
        <h2 className="section-title">2. Buttons (Tokens: Navy Primary, Steel-Blue Outline, Ghost, Danger)</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" size="lg">Primary Navy (lg)</Button>
          <Button variant="primary" size="md">Primary Navy (md)</Button>
          <Button variant="primary" size="sm">Primary Navy (sm)</Button>
          <Button
            variant="primary"
            loading={buttonLoading}
            onClick={() => {
              setButtonLoading(true);
              setTimeout(() => setButtonLoading(false), 1500);
            }}
          >
            {buttonLoading ? "Loading..." : "Click to Test Loading State"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" size="md">Secondary Outline</Button>
          <Button variant="ghost" size="md">Ghost Button</Button>
          <Button variant="danger" size="md">Danger Button</Button>
          <Button variant="primary" disabled size="md">Disabled State</Button>
        </div>
      </section>

      {/* 3. Badges & Mode Badges */}
      <section className="space-y-4">
        <h2 className="section-title">3. Mode Badges & Generic Badges</h2>
        <div className="flex flex-wrap items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[12px]">
          <div className="flex items-center gap-3">
            <span className="caption-text font-semibold">ModeBadges:</span>
            <ModeBadge mode="REAL" />
            <ModeBadge mode="CACHED" />
            <ModeBadge mode="DEMO" />
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-2">
            <span className="caption-text font-semibold">Badges:</span>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
          </div>
        </div>
      </section>

      {/* 4. Status Chips */}
      <section className="space-y-4">
        <h2 className="section-title">4. StatusChip (Icon + Word, 5 Specific States)</h2>
        <div className="flex flex-wrap items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[12px]">
          <StatusChip status="done" />
          <StatusChip status="skipped" />
          <StatusChip status="pending" />
          <StatusChip status="running" />
          <StatusChip status="error" />
        </div>
      </section>

      {/* 5. Tooltips */}
      <section className="space-y-4">
        <h2 className="section-title">5. Tooltip (Hover & Keyboard Focusable '?')</h2>
        <Card className="flex items-center gap-4">
          <span className="body-text">
            Test technical explanation tooltip:
          </span>
          <span className="font-semibold text-[15px] flex items-center">
            Synthetic likelihood
            <Tooltip content="Probability that caller audio was generated or manipulated by AI vocoders (0.00 to 1.00)." />
          </span>
          <span className="font-semibold text-[15px] flex items-center">
            Similarity
            <Tooltip content="Cosine similarity metric between incoming audio vector and reference voiceprint (-1.0 to 1.0)." />
          </span>
        </Card>
      </section>

      {/* 6. Banners */}
      <section className="space-y-4">
        <h2 className="section-title">6. Banners (Info, Warn, Error)</h2>
        <div className="space-y-3">
          <Banner variant="info" title="Information Notice">
            DetectifAI platform pipeline is operating under normal latency thresholds.
          </Banner>
          <Banner variant="warn" title="Secondary Verification Advised">
            Interactive liveness challenge required before authorizing sensitive transactions.
          </Banner>
          <Banner variant="error" title="Dynamic Liveness Challenge Failed">
            Liveness failure overrides prior scores. High likelihood of replay or synthetic pipeline attack.
          </Banner>
        </div>
      </section>

      {/* 7. Cards & Decision Cards */}
      <section className="space-y-4">
        <h2 className="section-title">7. Cards (24px Padding, 12px Radius, 1px Border, Soft Shadow)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card variant="default">
            <h3 className="card-title mb-1">Standard Surface Card</h3>
            <p className="body-text">Pure white card surface with soft shadow and 24px padding.</p>
          </Card>
          <Card variant="subtle">
            <h3 className="card-title mb-1">Subtle Fill Card</h3>
            <p className="body-text">Subtle fill token background for secondary panels.</p>
          </Card>
          <Card variant="decision-continue">
            <h3 className="card-title text-[var(--decision-continue-text)] mb-1">
              CONTINUE Decision Card
            </h3>
            <p className="body-text">6px solid green left border, tinted background, WCAG AA text.</p>
          </Card>
          <Card variant="decision-stepup">
            <h3 className="card-title text-[var(--decision-stepup-text)] mb-1">
              STEP_UP Decision Card
            </h3>
            <p className="body-text">6px solid amber left border, tinted background, WCAG AA text.</p>
          </Card>
          <Card variant="decision-endcall" className="md:col-span-2">
            <h3 className="card-title text-[var(--decision-endcall-text)] mb-1">
              END_CALL Decision Card
            </h3>
            <p className="body-text">6px solid red left border, tinted background, WCAG AA text.</p>
          </Card>
        </div>
      </section>

      {/* 8. Skeletons */}
      <section className="space-y-4">
        <h2 className="section-title">8. Skeletons (Pulse Loading)</h2>
        <Card className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      </section>

      {/* 9. Empty & Error States */}
      <section className="space-y-4">
        <h2 className="section-title">9. EmptyState & ErrorState</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmptyState
            icon={<Sparkles className="w-8 h-8" />}
            title="Empty State Component"
            description="Clear iconography, explanatory text, and one primary call-to-action."
            actionLabel="Execute Action"
            onAction={() => alert("Action triggered")}
          />
          <ErrorState
            title="Analysis Service Error"
            message="Unable to reach the platform inference gateway. Please check network connectivity."
            onRetry={() => alert("Retrying action...")}
          />
        </div>
      </section>

      {/* 10. Drawer & Modal Triggers */}
      <section className="space-y-4">
        <h2 className="section-title">10. Drawer & Modal (Focus Trapped, ESC Closes, Returns Focus)</h2>
        <div className="flex gap-4">
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
            Open Test Drawer
          </Button>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open Test Modal
          </Button>
        </div>
      </section>

      {/* Test Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Technical Details Drawer"
        subtitle="Testing focus trap and keyboard navigation"
      >
        <p className="body-text">
          Focus is trapped within this drawer. Pressing <kbd className="font-mono bg-[var(--fill-subtle)] px-1.5 py-0.5 rounded border border-[var(--border)]">Tab</kbd> cycles focus through interactive elements. Pressing <kbd className="font-mono bg-[var(--fill-subtle)] px-1.5 py-0.5 rounded border border-[var(--border)]">Escape</kbd> closes the drawer and returns focus to the button that opened it.
        </p>
        <div className="pt-4 flex gap-2">
          <Button variant="primary" onClick={() => setDrawerOpen(false)}>
            Close Drawer
          </Button>
          <Button variant="secondary" onClick={() => alert("Inner button focused")}>
            Focusable Action
          </Button>
        </div>
      </Drawer>

      {/* Test Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirmation Dialog"
        subtitle="Accessible dialog demonstration"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="body-text">
          This modal traps focus inside, supports ESC key dismiss, and automatically restores focus upon closing.
        </p>
      </Modal>
    </div>
  );
};
