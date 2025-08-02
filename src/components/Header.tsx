import { NavLink, useNavigate } from 'react-router-dom';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, LogOut, User, Settings, Users, Shield, Menu as MenuIcon, Package, Truck } from 'lucide-react';
import DynamicIcon from './DynamicIcon';

const Header = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <Navbar bg="light" expand="lg" className="shadow-sm">
      <Container fluid>
        <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
          <Building2 className="me-2" />
          <span>ERP System</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>Dashboard</Nav.Link>
            
            {hasPermission('freight_orders.manage') && <Nav.Link as={NavLink} to="/freight-orders">Frachtaufträge</Nav.Link>}
            {hasPermission('customers.manage') && <Nav.Link as={NavLink} to="/customers">Kunden</Nav.Link>}
            {hasPermission('vehicles.manage') && <Nav.Link as={NavLink} to="/vehicles">Fahrzeuge</Nav.Link>}

            {(hasPermission('users.manage') || hasPermission('roles.manage') || hasPermission('menus.manage') || hasPermission('settings.manage')) && (
              <NavDropdown title="Administration" id="admin-dropdown" renderOnMount>
                {hasPermission('users.manage') && <NavDropdown.Item as={NavLink} to="/users"><Users className="me-2 h-4 w-4" />Benutzer</NavDropdown.Item>}
                {hasPermission('roles.manage') && <NavDropdown.Item as={NavLink} to="/roles"><Shield className="me-2 h-4 w-4" />Gruppen & Rechte</NavDropdown.Item>}
                {hasPermission('menus.manage') && <NavDropdown.Item as={NavLink} to="/menus"><MenuIcon className="me-2 h-4 w-4" />Menü-Editor</NavDropdown.Item>}
                {hasPermission('settings.manage') && <NavDropdown.Item as={NavLink} to="/settings"><Settings className="me-2 h-4 w-4" />Einstellungen</NavDropdown.Item>}
              </NavDropdown>
            )}
          </Nav>
          <Nav>
            <NavDropdown title={<User />} id="user-dropdown" align="end" renderOnMount>
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