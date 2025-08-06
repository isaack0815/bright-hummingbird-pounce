import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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
        body: { action: 'login', user: loginIdentifier, pass: password },
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-boxdark-2">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Anmelden</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginIdentifier">Benutzername oder E-Mail</Label>
              <Input
                id="loginIdentifier"
                type="text"
                placeholder="max_mustermann oder m@example.com"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;