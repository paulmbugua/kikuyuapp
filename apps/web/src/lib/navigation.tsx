"use client";

import NextLink from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";
import React, { forwardRef, useCallback, useEffect } from "react";

export type NavigateOptions = {
  replace?: boolean;
  state?: unknown;
};

export type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
};

export type NavLinkProps = Omit<LinkProps, "className"> & {
  className?: string | ((state: { isActive: boolean; isPending: boolean }) => string);
  end?: boolean;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace: _replace, state: _state, ...props }, ref) => (
    <NextLink ref={ref} href={to} {...props} />
  ),
);
Link.displayName = "Link";

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, className, end = false, ...props }, ref) => {
    const pathname = usePathname() || "/";
    const active = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
    const resolvedClassName =
      typeof className === "function"
        ? className({ isActive: active, isPending: false })
        : className;

    return <Link ref={ref} to={to} className={resolvedClassName} {...props} />;
  },
);
NavLink.displayName = "NavLink";

export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (destination: string | number, options: NavigateOptions = {}) => {
      if (typeof destination === "number") {
        if (destination < 0) router.back();
        else if (destination > 0) router.forward();
        return;
      }

      if (options.replace) router.replace(destination);
      else router.push(destination);
    },
    [router],
  );
}

export function useLocation() {
  const pathname = usePathname() || "/";
  const searchParams = useNextSearchParams();
  const query = searchParams.toString();

  return {
    pathname,
    search: query ? `?${query}` : "",
    hash: "",
    state: null,
    key: pathname,
  };
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
  const pathname = usePathname() || "/";
  const segments = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  if (segments[0] === "profile" && segments[1]) params.username = decodeURIComponent(segments[1]);
  if (segments[0] === "post" && segments[1]) params.id = decodeURIComponent(segments[1]);
  if (segments[0] === "chat" && segments[1]) params.id = decodeURIComponent(segments[1]);

  return params as T;
}

export function useSearchParams() {
  return [useNextSearchParams()] as const;
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return null;
}

export function Outlet({ children = null }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
