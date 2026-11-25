export function ReviewBadge({ reviewed }: { reviewed: boolean }) {
  return reviewed ? (
    <span className="badge verified" title="Checked and approved by a human reviewer">
      Verified
    </span>
  ) : (
    <span className="badge draft" title="Draft content. A reviewer hasn't checked this yet.">
      Draft · not yet reviewed
    </span>
  )
}
