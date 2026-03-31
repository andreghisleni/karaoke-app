import { Link, useNavigate } from '@tanstack/react-router';

import { HardHat, LayoutTemplate, LogOutIcon, User } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getNameInitials } from '@/utils/get-name-initials';

export default function UserMenu() {
  // const { eventId } = useParams({
  //   strict: false,
  // });
  const initials = getNameInitials("André");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-auto p-0 hover:bg-transparent" variant="ghost">
          <Avatar>
            <AvatarImage alt="André" src={''} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-64">
        <DropdownMenuLabel className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground text-sm">
            André
          </span>
          <span className="truncate font-normal text-muted-foreground text-xs">
            andre@example.com
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to={'/settings/users'}>
              <User aria-hidden="true" className="opacity-60" size={16} />
              <span>Usuários</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings/responsibles">
              <HardHat aria-hidden="true" className="opacity-60" size={16} />
              <span>Responsáveis</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings/companies">
              <HardHat aria-hidden="true" className="opacity-60" size={16} />
              <span>Empresas</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings/types">
              <LayoutTemplate aria-hidden="true" className="opacity-60" size={16} />
              <span>Templates</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem onClick={handleLogout}>
          <LogOutIcon aria-hidden="true" className="opacity-60" size={16} />
          <span>Logout</span>
        </DropdownMenuItem> */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
