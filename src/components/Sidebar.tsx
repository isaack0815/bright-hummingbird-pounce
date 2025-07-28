import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Building2, LogOut, ChevronRight } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { MenuItem } from '@/types/menu';
import DynamicIcon from './DynamicIcon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ErrorLogViewer } from './ErrorLogViewer';

const buildMenuTree = (items: MenuItem[]): MenuItem[] => {
  const itemMap = new Map<number, MenuItem>();
  const tree: MenuItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  itemMap.forEach(item => {
    if (item.parent_id && itemMap.has(item.parent_id)) {
      const parent = itemMap.get(item.parent_id);
      parent?.children?.push(item);
    } else {
      tree.push(item);
    }
  });

  return tree;
};

const SidebarMenuItem = ({ item }: { item: MenuItem }) => {
  const location = useLocation();
  
  if (!item.children || item.children.length === 0) {
    return (
      <NavLink
        to={item.link || '#'}
        end={item.link === '/'}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
            isActive ? 'bg-muted text-primary' : ''
          }`
        }
      >
        {item.icon && <DynamicIcon name={item.icon} className="h-4 w-4" />}
        {item.name}
      </NavLink>
    );
  }

  const isChildActive = useMemo(() => 
    item.children?.some(child => location.pathname.startsWith(child.link || '___')),
    [item.children, location.pathname]
  );

  return (
    <Collapsible defaultOpen={isChildActive}>
      <CollapsibleTrigger className="w-full text-left">
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
          <div className="flex items-center gap-3">
            {item.icon && <DynamicIcon name={item.icon} className="h-4 w-4" />}
            {item.name}
          </div>
          <ChevronRight className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-90" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 border-l border-muted-foreground/20 ml-4">
        <nav className="grid items-start py-1 text-sm font-medium">
          {item.children.map(child => (
            <SidebarMenuItem key={child.id} item={child} />
          ))}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
};

const fetchMenuItems = async (): Promise<MenuItem[]> => {
  const { data, error } = await supabase.functions.invoke('get-menu-items');
  if (error) throw new Error(error.message);
  return data.items;
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(error.message);
    } else {
      navigate('/login');
    }
  };

  const menuTree = useMemo(() => {
    if (!menuItems) return [];
    return buildMenuTree(menuItems);
  }, [menuItems]);

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-6 w-6" />
          <span>ERP System</span>
        </NavLink>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {isLoading ? (
            <div className="p-4 text-muted-foreground">Menü wird geladen...</div>
          ) : (
            menuTree.map(item => <SidebarMenuItem key={item.id} item={item} />)
          )}
        </nav>
      </div>
      <div className="mt-auto p-4 space-y-2">
        <ErrorLogViewer />
        <Button size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;