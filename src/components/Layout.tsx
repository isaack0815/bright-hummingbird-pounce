import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { ChatWidget } from './chat/ChatWidget';
import { Container } from 'react-bootstrap';
import BottomNavBar from './BottomNavBar';

const Layout = () => {
  const location = useLocation();
  const isDriverDashboard = location.pathname === '/driver/dashboard';

  return (
    <div className="d-flex flex-column min-vh-100">
      {!isDriverDashboard && <Header />}
      <main className="flex-grow-1">
        <Container fluid className={isDriverDashboard ? "pb-5" : "p-4 pb-5"}>
          <Outlet />
        </Container>
      </main>
      <ChatWidget />
      <BottomNavBar />
    </div>
  );
};

export default Layout;