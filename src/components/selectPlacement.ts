export interface SelectPlacementInput {
  triggerTop: number;
  triggerBottom: number;
  menuHeight: number;
  maxMenuHeight?: number;
  boundaryTop: number;
  boundaryBottom: number;
  gap?: number;
}

export interface SelectPlacement {
  side: "top" | "bottom";
  maxHeight: number;
}

export function calculateSelectPlacement(
  input: SelectPlacementInput,
): SelectPlacement {
  const gap = input.gap ?? 6;
  const spaceAbove = Math.max(0, input.triggerTop - input.boundaryTop - gap);
  const spaceBelow = Math.max(
    0,
    input.boundaryBottom - input.triggerBottom - gap,
  );
  const maxMenuHeight = input.maxMenuHeight ?? Number.POSITIVE_INFINITY;
  const desiredHeight = Math.min(input.menuHeight, maxMenuHeight);
  const side: SelectPlacement["side"] =
    desiredHeight > spaceBelow && spaceAbove > spaceBelow ? "top" : "bottom";
  const availableHeight = side === "top" ? spaceAbove : spaceBelow;

  return {
    side,
    maxHeight: Math.min(availableHeight, maxMenuHeight),
  };
}
