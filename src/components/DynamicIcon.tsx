import React from 'react';
import {
  Home,
  Users,
  Shield,
  Menu as MenuIcon,
  Building2,
  LogOut,
  Package,
  User,
  ChevronRight,
  Truck,
  Settings,
  type LucideProps,
} from 'lucide-react';

const iconMap = {
  Home,
  Users,
  Shield,
  Menu: MenuIcon,
  Building2,
  LogOut,
  User,
  ChevronRight,
  Package,
  Truck,
  Settings,
};

type IconName = keyof typeof iconMap;

interface DynamicIconProps extends LucideProps {
  name: IconName | string;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const IconComponent = iconMap[name as IconName] || Package;
  return <IconComponent {...props} />;
};

export default DynamicIcon;