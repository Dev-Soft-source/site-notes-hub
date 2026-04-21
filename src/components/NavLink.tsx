"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, pendingClassName: _pendingClassName, href, ...props }, ref) => {
    const pathname = usePathname();
    const hrefStr =
      typeof href === "string"
        ? href
        : typeof href === "object" && href !== null && "pathname" in href && href.pathname
          ? String(href.pathname)
          : "";
    const isActive =
      hrefStr === pathname || (hrefStr !== "" && hrefStr !== "/" && pathname.startsWith(hrefStr));

    return (
      <Link ref={ref} href={href} className={cn(className, isActive && activeClassName)} {...props} />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
