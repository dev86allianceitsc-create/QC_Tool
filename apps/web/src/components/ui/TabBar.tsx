export interface TabBarItem {
  key: string;
  label: string;
}

// Horizontal top-level section switcher (API Detail's Configuration / Run
// API / Run History). Deliberately simpler than StepSidebar: sections here
// are always reachable — each section's own content explains any blocked
// or not-ready state, so this bar never disables or hides an item.
export function TabBar({
  items,
  activeKey,
  onSelect,
  ariaLabel = "Tabs",
}: {
  items: TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-6 border-b border-border px-6">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.key)}
            className={`cursor-pointer border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-gray-900"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
