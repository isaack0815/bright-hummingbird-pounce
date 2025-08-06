import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DynamicIcon from './DynamicIcon';
import type { MenuItem } from '@/types/menu';
import { Building2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type TreeMenuItem = Omit<MenuItem, 'children'> & { children: TreeMenuItem[] };

const fetchMenuItems = async (): Promise<MenuItem[]> => {
  const { data, error } = await supabase.functions.invoke('get-menu-items');
  if (error) throw new Error(error.message);
  return data.items;
};

const buildTree = (items: MenuItem[]): TreeMenuItem[] => {
  const itemMap = new Map<number, TreeMenuItem>();
  const tree: TreeMenuItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  items.forEach(item => {
    if (item.parent_id && itemMap.has(item.parent_id)) {
      const parent = itemMap.get(item.parent_id)!;
      parent.children.push(itemMap.get(item.id)!);
    } else {
      tree.push(itemMap.get(item.id)!);
    }
  });

  const sortChildren = (node: TreeMenuItem) => {
    node.children.sort((a, b) => a.position - b.position);
    node.children.forEach(sortChildren);
  };
  tree.sort((a, b) => a.position - b.position);
  tree.forEach(sortChildren);

  return tree;
};

const SidebarMenuItem = ({ item, closeSidebar }: { item: TreeMenuItem, closeSidebar: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const baseLinkClasses = "flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4";
  const activeLinkClasses = "bg-graydark dark:bg-meta-4";

  if (!hasChildren) {
    return (
      <li>
        <NavLink
          to={item.link || '#'}
          onClick={closeSidebar}
          className={({ isActive }) => cn(baseLinkClasses, isActive && activeLinkClasses)}
        >
          <DynamicIcon name={item.icon || 'Package'} />
          {item.name}
        </NavLink>
      </li>
    );
  }

  return (
    <li>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); handleToggle(); }}
        className={`${baseLinkClasses} justify-between`}
      >
        <span className="flex items-center gap-2.5">
          <DynamicIcon name={item.icon || 'Package'} />
          {item.name}
        </span>
        <ChevronDown className={cn("transition-transform", isOpen && "rotate-180")} />
      </a>
      {isOpen && (
        <div className="overflow-hidden">
          <ul className="mt-2 flex flex-col gap-2.5 pl-6">
            {item.children.map(child => (
              <SidebarMenuItem key={child.id} item={child} closeSidebar={closeSidebar} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

export const Sidebar = ({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) => {
  const { hasPermission } = useAuth();
  const { data: menuItems, isLoading: isLoadingMenu } = useQuery<MenuItem[]>({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
  });

  const visibleItems = menuItems?.filter(item => !item.required_permission || hasPermission(item.required_permission)) || [];
  const menuTree = buildTree(visibleItems);

  const closeSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }

  return (
    <aside
      className={cn(
        "absolute left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-y-hidden bg-black duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0",
        {
          "translate-x-0": sidebarOpen,
          "-translate-x-full": !sidebarOpen,
        }
      )}
    >
      <div className="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5">
        <NavLink to="/" className="flex items-center gap-2">
          <Building2 className="text-white" size={32} />
          <h1 className="text-2xl font-bold text-white">ERP System</h1>
        </NavLink>
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
          <div>
            <h3 className="mb-4 ml-4 text-sm font-semibold text-bodydark2">MENU</h3>
            <ul className="mb-6 flex flex-col gap-1.5">
              {isLoadingMenu ? <p className="text-white">Loading...</p> : menuTree.map(item => (
                <SidebarMenuItem key={item.id} item={item} closeSidebar={closeSidebar} />
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
};