"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/inspections", label: "Inspections" },
  { href: "/templates", label: "Templates" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={`navlink${active ? " active" : ""}`}>
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
