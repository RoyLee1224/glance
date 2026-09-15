// A representative iPhone screen, independent of the exported photo dimensions.
export const IPHONE_SCREEN = { width: 393, height: 852 };

export function phonePhotoBounds(width: number, height: number) {
  const ratio = width / height;
  const screenRatio = IPHONE_SCREEN.width / IPHONE_SCREEN.height;
  const scaleX = Math.max(1, ratio / screenRatio);
  const scaleY = Math.max(1, screenRatio / ratio);
  return { width: scaleX * 100, height: scaleY * 100 };
}
