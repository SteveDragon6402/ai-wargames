/** A visible pause, so a wait does not look like a crash. */
export function Wait({ children }: { children: string }) {
  return (
    <p className="sj-wait" role="status">
      <span className="sj-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {children}
    </p>
  );
}
