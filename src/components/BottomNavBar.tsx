import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Truck, Clock, User, Plane } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BottomNavBar = () => {
  const { hasPermission } = useAuth();
  const isDriver = hasPermission('driver.dashboard.access');

  const navItems = [
    { href: isDriver ? '/driver/dashboard' : '/', icon: LayoutDashboard, label: 'Dashboard', permission: null },
    !isDriver && { href: '/driver/dashboard', icon: Truck, label: 'Fahrer', permission: 'driver.dashboard.access' },
    { href: '/work-time', icon: Clock, label: 'Zeiterfassung', permission: null },
    { href: '/vacation-requests', icon: Plane, label: 'Urlaub', permission: null },
    { href: '/profile', icon: User, label: 'Profil', permission: null },
  ].filter(Boolean) as { href: string; icon: React.ElementType; label: string; permission: string | null; }[];

  const activeLinkClass = "text-primary";
  const inactiveLinkClass = "text-muted";

  return (
    <nav className="fixed-bottom bg-light border-top shadow-lg p-2 d-md-none">
      <div className="d-flex justify-content-around align-items-center">
        {navItems.map(item => {
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) => 
                `d-flex flex-column align-items-center text-decoration-none ${isActive ? activeLinkClass : inactiveLinkClass}`
              }
            >
              <item.icon size={24} />
              <span className="small" style={{ fontSize: '0.7rem' }}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;