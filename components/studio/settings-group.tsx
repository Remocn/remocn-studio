import type { ReactNode } from "react";

export function SettingsGroup({
  title,
  action,
  description,
  children,
}: {
  title: string;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="grid min-w-0 gap-4">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <h3 className="font-medium text-[14px] leading-5">{title}</h3>
          {description ? (
            <p className="text-muted-foreground text-sm leading-[18px]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsPanel({
  children,
  ...props
}: Parameters<typeof SettingsGroup>[0]) {
  return (
    <SettingsGroup {...props}>
      <div className="grid min-w-0 gap-4">{children}</div>
    </SettingsGroup>
  );
}
