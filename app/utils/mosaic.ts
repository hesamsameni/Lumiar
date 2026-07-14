// Deterministic tile-size pattern for the mosaic feeds. Returns Tailwind span
// classes so a fraction of tiles become large / tall / wide, giving the grid a
// varied, editorial rhythm. `grid-flow-row-dense` on the container backfills the
// gaps the larger tiles create.
export function mosaicSpan(index: number): string {
  // Cycle of 12 keeps roughly: 1 big, 2 tall, 1 wide per dozen tiles.
  switch (index % 12) {
    case 0:
      return "sm:col-span-2 sm:row-span-2"; // large feature
    case 4:
    case 9:
      return "row-span-2"; // tall
    case 7:
      return "sm:col-span-2"; // wide
    default:
      return "";
  }
}
