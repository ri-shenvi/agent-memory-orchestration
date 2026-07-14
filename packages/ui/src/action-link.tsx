import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

export interface ActionLinkProps {
  readonly children: ReactNode;
  readonly href: string;
}

export function ActionLink({
  children,
  href,
}: ActionLinkProps): ReactElement<ComponentPropsWithoutRef<"a">, "a"> {
  return (
    <a
      className="inline-flex rounded-lg bg-sky-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-300"
      href={href}
    >
      {children}
    </a>
  );
}
