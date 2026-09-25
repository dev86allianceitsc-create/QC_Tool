// Tiny hand-rolled inline SVGs — this app has no icon library dependency, so
// these stay minimal rather than pulling one in for a couple of glyphs.

export function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6" />
      <path d="M17 17l-4-4" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M6 2.5h5.5L15 6v11a.5.5 0 01-.5.5h-8A.5.5 0 016 17V3a.5.5 0 01.5-.5z" strokeLinejoin="round" />
      <path d="M11.5 2.5V6H15" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" strokeLinejoin="round" />
      <path d="M13 7V4.5A1.5 1.5 0 0011.5 3h-8A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14H6" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
