export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface Size {
  height: number;
  width: number;
}

export interface Placement {
  x: number;
  y: number;
}

export const CARD_GAP = 8;

export function boxOf(rect: Box, stage: Size): Box {
  return {
    height: rect.height * stage.height,
    width: rect.width * stage.width,
    x: rect.x * stage.width,
    y: rect.y * stage.height,
  };
}

export function cardPlacement(
  element: Box,
  stage: Size,
  card: Size,
  gap: number = CARD_GAP
): Placement {
  const below = element.y + element.height + gap;
  const above = element.y - gap - card.height;
  const left = element.x;
  const right = element.x + element.width - card.width;

  return {
    x: clamp(
      left + card.width <= stage.width ? left : right,
      stage.width - card.width
    ),
    y: clamp(
      below + card.height <= stage.height ? below : above,
      stage.height - card.height
    ),
  };
}

function clamp(value: number, most: number): number {
  return Math.max(0, Math.min(value, Math.max(most, 0)));
}
