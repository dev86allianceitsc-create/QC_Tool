import type { HTMLAttributes, ReactNode } from "react"

type CardPadding = "md" | "lg"

const PADDING_CLASSES: Record<CardPadding, string> = {
  md: "p-5",
  lg: "p-7",
}

export function Card({
  className = "",
  padding = "md",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; padding?: CardPadding }) {
  return (
    <div
      {...rest}
      className={`rounded-lg border border-border bg-white ${PADDING_CLASSES[padding]} ${className}`}
    >
      {children}
    </div>
  )
}
