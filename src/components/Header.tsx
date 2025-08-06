import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from './ui/button';

const Header = ({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 flex w-full bg-white drop-shadow-sm dark:bg-boxdark dark:drop-shadow-none">
      <div className="flex flex-grow items-center justify-between py-4 px-4 shadow-sm md:px-6 2xl:px-11">
        <div className="flex items-center gap-2 sm:gap-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        <div className="hidden sm:block">
          {/* Can add a search bar here later if needed */}
        </div>

        <div className="flex items-center gap-3 2xsm:gap-7 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <User />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;