import { Badge, type BadgeTone } from "./Badge";

export type StepReadiness = "configured" | "not_configured" | "needs_attention" | "not_available";

const READINESS_LABEL: Record<StepReadiness, string> = {
  configured: "Configured",
  not_configured: "Not Configured",
  needs_attention: "Needs Attention",
  not_available: "Not Available",
};

const READINESS_TONE: Record<StepReadiness, BadgeTone> = {
  configured: "success",
  not_configured: "neutral",
  needs_attention: "warning",
  not_available: "neutral",
};

export interface StepSidebarItem {
  key: string;
  label: string;
  description: string;
  readiness?: StepReadiness;
}

// API Workspace guided navigation: every step stays directly reachable
// (never locked); the caller decides how to derive `readiness` from real
// data so this component never invents configuration-status rules.
export function StepSidebar({
  steps,
  activeKey,
  onSelect,
  ariaLabel = "Steps",
}: {
  steps: StepSidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="w-60 shrink-0 md:border-r md:border-border md:pr-4">
      <ol className="flex flex-col gap-1">
        {steps.map((step, index) => {
          const active = step.key === activeKey;
          return (
            <li key={step.key}>
              <button
                onClick={() => onSelect(step.key)}
                aria-label={step.label}
                className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${active ? "bg-primary-light" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active ? "bg-primary text-white" : "bg-gray-100 text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`text-sm ${active ? "font-semibold text-gray-900" : "text-gray-700"}`}>{step.label}</span>
                </div>
                <p className="ml-7 mt-0.5 text-xs text-muted">{step.description}</p>
                {step.readiness && (
                  <span className="ml-7 mt-1.5 inline-block">
                    <Badge tone={READINESS_TONE[step.readiness]} label={READINESS_LABEL[step.readiness]} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
