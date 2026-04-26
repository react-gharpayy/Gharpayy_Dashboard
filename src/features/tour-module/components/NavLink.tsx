"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends React.ComponentPropsWithoutRef<typeof Link> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, href, ...props }, ref) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    const isPending = false; // Next.js Link doesn't have a direct equivalent for isPending, set to false for now.

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive && activeClassName, isPending && pendingClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

