import { Link } from "@tanstack/react-router";
import Logo from "@/components/navbar-components/logo";
import { ThemeSwitcher } from "@/components/navbar-components/theme-switcher";
import UserMenu from "@/components/navbar-components/user-menu";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MenuLink } from "./menu-link";

export function Header() {
  // Navigation links array to be used in both desktop and mobile menus
  const navigationLinks = [
    { href: "/dashboard", label: "Dashboard" },
    {
      href: "/config",
      label: "Configurações",
    },
    {
      href: "/orders",
      label: "Pedidos",
      role: ["admin"],
    },
  ];

  const nLinks = navigationLinks.filter((link) => {

    return true;
  });

  return (
    <header className="border-b px-4 md:px-6 print:*:hidden">
      <div className="flex h-16 items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-2">
          {/* Mobile menu trigger */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="group size-8 md:hidden"
                size="icon"
                variant="ghost"
              >
                {/* ícone do menu */}
                <svg
                  className="pointer-events-none"
                  fill="none"
                  height={16}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width={16}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Menu</title>
                  <path
                    className="-translate-y-[7px] origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]"
                    d="M4 12L20 12"
                  />
                  <path
                    className="origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
                    d="M4 12H20"
                  />
                  <path
                    className="origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]"
                    d="M4 12H20"
                  />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-36 p-1 md:hidden">
              <NavigationMenu className="max-w-none *:w-full">
                <NavigationMenuList className="flex-col items-start gap-0 md:gap-2">
                  {nLinks.map((link, index) => (
                    <NavigationMenuItem
                      className="w-full"
                      key={index.toString()}
                    >
                      <MenuLink className="py-1.5" href={link.href}>
                        {link.label}
                      </MenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </PopoverContent>
          </Popover>

          {/* Main nav */}
          <div className="flex items-center gap-6">
            <Link
              className="text-primary hover:text-primary/90"
              to="/dashboard"
            >
              <Logo />
            </Link>
            {/* {data?.user.role} */}
            {/* Navigation menu */}
            <NavigationMenu className="max-md:hidden">
              <NavigationMenuList className="gap-2">
                {nLinks.map((link, index) => (
                  <NavigationMenuItem key={index.toString()}>
                    <MenuLink
                      className="py-1.5 font-medium text-muted-foreground hover:text-primary"
                      href={link.href}
                    >
                      {link.label}
                    </MenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Info menu */}
            {/* <InfoMenu /> */}
            {/* Notification */}
            {/* <NotificationMenu /> */}
            {/* Theme switcher */}
            <ThemeSwitcher />
          </div>
          {/* User menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
