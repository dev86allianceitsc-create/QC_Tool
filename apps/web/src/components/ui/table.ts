// Shared table cell classes so API List, Environment List, and Members

// render visually consistent tables without a heavier <Table> component.

export const thClass =
  "border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted"

// Centered header variant for columns like "Actions": built by swapping the
// alignment token rather than appending "text-center" onto thClass, because
// appending would leave both text-left and text-center present on the same
// element — a same-specificity conflict whose winner depends on Tailwind's
// generated CSS order, not on source order, and reliably rendered left-
// aligned in practice (the header stayed left-aligned while the cell below,
// which has no competing alignment class, centered correctly).
export const thCenterClass = thClass.replace("text-left", "text-center")

export const tdClass =
  "border-b border-border px-3 py-2.5 text-sm text-gray-900"

export const trHoverClass = "hover:bg-gray-50"
