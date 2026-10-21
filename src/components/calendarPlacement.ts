export interface CalendarBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CalendarPlacementInput {
  trigger: CalendarBounds;
  boundary: CalendarBounds;
  width: number;
  height: number;
  align?: "start" | "end";
  gap?: number;
  padding?: number;
}

export function calculateCalendarPlacement(input: CalendarPlacementInput) {
  const gap = input.gap ?? 6;
  const padding = input.padding ?? 8;
  const leftEdge = input.boundary.left + padding;
  const rightEdge = input.boundary.right - padding;
  const topEdge = input.boundary.top + padding;
  const bottomEdge = input.boundary.bottom - padding;
  const maxWidth = Math.max(0, rightEdge - leftEdge);
  const width = Math.min(input.width, maxWidth);
  const above = Math.max(0, input.trigger.top - gap - topEdge);
  const below = Math.max(0, bottomEdge - input.trigger.bottom - gap);
  const side = input.height > below && above > below ? "top" : "bottom";
  const maxHeight = side === "top" ? above : below;
  const height = Math.min(input.height, maxHeight);
  const preferredLeft =
    input.align === "end" ? input.trigger.right - width : input.trigger.left;

  return {
    side,
    left: Math.max(leftEdge, Math.min(preferredLeft, rightEdge - width)),
    top:
      side === "top"
        ? Math.max(topEdge, input.trigger.top - gap - height)
        : Math.min(bottomEdge - height, input.trigger.bottom + gap),
    maxWidth,
    maxHeight,
  };
}
