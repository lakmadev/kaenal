/** Standard page header (matches the prototype's PageHeader): title + optional
 *  description on the left, action buttons on the right. Used by every module. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-text">{title}</h1>
        {description !== undefined && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
