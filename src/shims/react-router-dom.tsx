"use client";

import Link, { type LinkProps } from "next/link";
import { useParams as useNextParams, usePathname, useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type ShimLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href"> & {
    to: string;
    children?: ReactNode;
  };

export function useNavigate() {
  const router = useRouter();

  return (to: string, opts?: { replace?: boolean; state?: unknown; [k: string]: unknown }) => {
    if (opts?.replace) {
      router.replace(to);
      return;
    }
    router.push(to);
  };
}

export function useParams<T extends Record<string, string>>() {
  const raw = useNextParams<Record<string, string | string[]>>();
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : (v ?? "")])
  );
  return normalized as T;
}

export function useLocation() {
  const pathname = usePathname();
  return { pathname };
}

export function LinkShim({ to, children, ...props }: ShimLinkProps) {
  return (
    <Link href={to} {...props}>
      {children}
    </Link>
  );
}

export { LinkShim as Link };
