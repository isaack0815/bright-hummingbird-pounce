import { NavLink, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Home, Users, Shield, Menu as MenuIcon, LogOut, Building2 } from 'lucide-react';
import { showError } from '@/utils/toast';

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(error.message);
    } else {
      navigate('/login');
    }
  };

  const navItems = [
    { to: '/', icon: <Home className="h-5 w-5" />, label: 'Dashboard' },
    { to: '/users', icon: <Users className="h-5 w-5" />, label: 'Nutzerverwaltung' },
    { to: '/roles', icon: <Shield className="h-5 w-5" />, label: 'Rechteverwaltung' },
    { to: '/menus', icon: <MenuIcon className="h-5 w-5" />, label: 'Menüverwaltung' },
  ];

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-6 w-6" />
          <span>ERP System</span>
        </NavLink>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                  isActive ? 'bg-muted text-primary' : ''
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <Button size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;