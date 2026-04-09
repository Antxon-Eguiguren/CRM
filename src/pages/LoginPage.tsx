import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Moon, Sun } from 'lucide-react';
import { AppearanceMenu } from '@/components/layout/AppearanceMenu';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (session) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      setFormError(error.message);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
        <AppearanceMenu
          contentSide="bottom"
          trigger={
            <Button type="button" variant="outline" size="icon" aria-label="Theme">
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>
          }
        />
      </div>
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl tracking-tight">Sign in</CardTitle>
          <CardDescription>
            Use your account email and password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  aria-invalid={!!formError}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  aria-invalid={!!formError}
                />
              </Field>
              {formError ? <FieldError>{formError}</FieldError> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
