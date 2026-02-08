"use client";

import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { cn } from "@/libs/utils";

interface NavLinkProps extends Omit<LinkProps, "className" | "href"> {
  href: string;
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, pendingClassName, href, ...props }, ref) => {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    const isPending = false; // Next.js doesn't have pending state, but keeping for API compatibility

    const computedClassName =
      typeof className === "function"
        ? className({ isActive, isPending })
        : cn(
            className,
            isActive && activeClassName,
            isPending && pendingClassName
          );

    return (
      <Link
        ref={ref}
        href={href}
        className={computedClassName}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
