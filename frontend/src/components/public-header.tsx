/** biome-ignore-all lint/performance/noImgElement: <explanation> */
import { Link } from '@tanstack/react-router';
import { MenuLink } from './navbar-components/menu-link';
import {
  ThemeSwitcher,
} from './navbar-components/theme-switcher';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from './ui/navigation-menu';

const publicLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/recuperar-pedido', label: 'Recuperar Pedido' },
];

export function PublicHeader() {
  return (
    <header className="flex w-full items-center justify-between border-gray-200 border-b bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-black">
      <Link
        className="flex items-center gap-2 font-bold text-lg text-teal-700 dark:text-teal-400"
        to="/"
      >
        <img
          alt="Logo"
          className="h-12 w-12 rounded-full object-cover"
          src="/logo.jpg"
        />
        E-commerce
      </Link>
      <NavigationMenu>
        <NavigationMenuList className="gap-2">
          {publicLinks.map((link, index) => (
            <NavigationMenuItem key={index.toString()}>
              <MenuLink
                className="py-1.5 font-medium text-gray-600 text-sm hover:text-teal-700 dark:text-gray-300 dark:hover:text-teal-400"
                href={link.href}
              >
                {link.label}
              </MenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <ThemeSwitcher />
    </header>
  );
}
