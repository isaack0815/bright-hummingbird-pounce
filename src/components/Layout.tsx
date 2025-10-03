import { Outlet } from 'react-router-dom';
import Header from './Header';
import { ChatWidget } from './chat/ChatWidget';
import { Container } from 'react-bootstrap';
import BottomNavBar from './BottomNavBar';

const Layout = () => {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      <main className="flex-grow-1">
        <Container fluid className="p-4 pb-5 mb-5">
          <Outlet />
        </Container>
      </main>
      <ChatWidget />
      <BottomNavBar />
    </div>
  );
};

export default Layout;