import { Outlet } from 'react-router-dom';
import Header from './Header';
import { ChatWidget } from './chat/ChatWidget';
import { Container } from 'react-bootstrap';

const Layout = () => {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      <main className="flex-grow-1">
        <Container fluid className="p-4">
          <Outlet />
        </Container>
      </main>
      <ChatWidget />
    </div>
  );
};

export default Layout;