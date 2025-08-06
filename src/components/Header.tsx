import { NavLink, useNavigate } from 'react-router-dom';
import { Navbar, Nav, NavDropdown, Container, Spinner } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import DynamicIcon from './DynamicIcon';
import { useQuery } from '@tanstack/react-query';
import type { MenuItem } from '@/types/menu';

type TreeMenuItem = MenuItem & { children: TreeMenuItem[] };

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

const Header = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const { data: menuItems, isLoading: isLoadingMenu } = useQuery<MenuItem[]>({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const visibleItems = menuItems?.filter(item => 
    !item.required_permission || hasPermission(item.required_permission)
  ) || [];

  const menuTree = buildTree(visibleItems);

  const renderMenuItems = (items: TreeMenuItem[]) => {
    return items.map(item => {
      if (item.children && item.children.length > 0) {
        return (
          <NavDropdown 
            title={
              <span className="d-inline-flex align-items-center">
                {item.icon && <DynamicIcon name={item.icon} className="me-2 h-4 w-4" />}
                {item.name}
              </span>
            } 
            id={`dropdown-${item.id}`} 
            key={item.id}
          >
            {item.children.map(child => (
              <NavDropdown.Item as={NavLink} to={child.link || '#'} key={child.id}>
                {child.icon && <DynamicIcon name={child.icon} className="me-2 h-4 w-4" />}
                {child.name}
              </NavDropdown.Item>
            ))}
          </NavDropdown>
        );
      }
      return (
        <Nav.Link as={NavLink} to={item.link || '#'} key={item.id}>
          {item.icon && <DynamicIcon name={item.icon} className="me-2 h-4 w-4" />}
          {item.name}
        </Nav.Link>
      );
    });
  };

  return (
    <Navbar bg="light" expand="lg" className="shadow-sm">
      <Container fluid>
        <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
          <DynamicIcon name="Building2" className="me-2" />
          <span>ERP System</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {isLoadingMenu ? <Spinner animation="border" size="sm" /> : renderMenuItems(menuTree)}
          </Nav>
          <Nav>
            <NavDropdown title={<User />} id="user-dropdown" align="end" renderMenuOnMount popperConfig={{ strategy: 'fixed' }}>
              <NavDropdown.Item as={NavLink} to="/profile">
                <User className="me-2 h-4 w-4" /> Mein Profil
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                <LogOut className="me-2 h-4 w-4" /> Abmelden
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;