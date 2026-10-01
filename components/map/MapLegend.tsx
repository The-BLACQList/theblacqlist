/** Desktop legend pill, bottom-left of the map. Text carries the meaning. */
export function MapLegend() {
  return (
    <ul
      aria-label="Map legend"
      className="absolute bottom-8 left-4 z-20 m-0 flex list-none items-center gap-4 rounded-full bg-white px-4 py-2 text-[12.5px] text-ink shadow-[0_6px_20px_rgba(29,28,29,0.2)]"
    >
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-4 rounded-full border-2 border-white bg-ink ring-1 ring-ink/30" />
        Top picks
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 rounded-full bg-ink/55" />
        Business
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-4 rounded-full border-[1.5px] border-ink bg-white" />
        Group
      </li>
    </ul>
  )
}
