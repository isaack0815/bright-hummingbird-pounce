import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginIdentifier);

    if (isEmail) {
      // Standard email login
      const { error } = await supabase.auth.signInWithPassword({
        email: loginIdentifier,
        password,
      });

      if (error) {
        setError(error.message);
        showError(error.message);
      } else {
        showSuccess('Anmeldung erfolgreich!');
        navigate('/');
      }
    } else {
      // Username login via Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke('action', {
        method: 'POST',
        body: { 
          action: 'login', 
          payload: { username: loginIdentifier, password: password } 
        },
      });

      if (invokeError) {
        setError(invokeError.message);
        showError(invokeError.message);
      } else if (data.error) {
        setError(data.error);
        showError(data.error);
      } else if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          setError(sessionError.message);
          showError(sessionError.message);
        } else {
          showSuccess('Anmeldung erfolgreich!');
          navigate('/');
        }
      } else {
        const msg = 'Ein unerwarteter Fehler ist aufgetreten.';
        setError(msg);
        showError(msg);
      }
    }
    setLoading(false);
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <Card style={{ width: '24rem' }} className="shadow-sm">
        <Card.Header className="p-4">
          <Card.Title as="h2" className="text-center">Anmelden</Card.Title>
        </Card.Header>
        <Card.Body className="p-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3" controlId="loginIdentifier">
              <Form.Label>Benutzername oder E-Mail</Form.Label>
              <Form.Control
                type="text"
                placeholder="max_mustermann oder m@example.com"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-4" controlId="password">
              <Form.Label>Passwort</Form.Label>
              <Form.Control
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Group>

            <div className="d-grid">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    <span className="ms-2">Anmelden...</span>
                  </>
                ) : (
                  'Anmelden'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Login;