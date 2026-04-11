import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { insertClient } from '@/lib/supabase-queries';
import type { Client } from '@/lib/types';
import { supabase } from '@/supabaseClient';

const clientFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company_name: z.string(),
  cif: z.string(),
  street: z.string(),
  postal_code: z.string(),
  city: z.string(),
  province: z.string(),
  comments: z.string(),
  source: z.string(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

type ClientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSaved: () => void;
  /** When true, show fields disabled with no save (row “view”). Requires `client`. */
  readOnly?: boolean;
};

function toNullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
  readOnly = false,
}: ClientFormDialogProps) {
  const { user } = useAuth();
  const isEdit = Boolean(client);
  const isView = readOnly && Boolean(client);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: '',
      company_name: '',
      cif: '',
      street: '',
      postal_code: '',
      city: '',
      province: '',
      comments: '',
      source: '',
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      name: client?.name ?? '',
      company_name: client?.company_name ?? '',
      cif: client?.cif ?? '',
      street: client?.street ?? '',
      postal_code: client?.postal_code ?? '',
      city: client?.city ?? '',
      province: client?.province ?? '',
      comments: client?.comments ?? '',
      source: client?.source ?? '',
    });
  }, [open, client, reset]);

  async function onSubmit(values: ClientFormValues) {
    if (isView) return;
    if (!user) {
      toast.error('You must be signed in.');
      return;
    }

    const payload = {
      name: values.name.trim(),
      company_name: toNullIfEmpty(values.company_name),
      cif: toNullIfEmpty(values.cif),
      street: toNullIfEmpty(values.street),
      postal_code: toNullIfEmpty(values.postal_code),
      city: toNullIfEmpty(values.city),
      province: toNullIfEmpty(values.province),
      comments: toNullIfEmpty(values.comments),
      source: toNullIfEmpty(values.source),
    };

    if (isEdit && client) {
      const { error } = await supabase
        .from('clients')
        .update({
          name: payload.name,
          company_name: payload.company_name,
          cif: payload.cif,
          street: payload.street,
          postal_code: payload.postal_code,
          city: payload.city,
          province: payload.province,
          comments: payload.comments,
          source: payload.source,
        })
        .eq('id', client.id);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Client updated');
    } else {
      const { error } = await supabase
        .from('clients')
        .insert(insertClient(user.id, payload));

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Client created');
    }

    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(730px,calc(100svh-2rem))] overflow-hidden sm:max-w-xl"
        showCloseButton>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isView ? 'Client details' : isEdit ? 'Edit client' : 'New client'}
            </DialogTitle>
          </DialogHeader>
          <form
            id="client-form"
            onSubmit={(e) => {
              if (isView) {
                e.preventDefault();
                return;
              }
              void handleSubmit(onSubmit)(e);
            }}>
            <FieldGroup className="gap-4 py-1">
            <Field>
              <FieldLabel htmlFor="client-name">Name</FieldLabel>
              <Input
                id="client-name"
                autoComplete="organization"
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name ? (
                <FieldError>{errors.name.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="client-company">Company name</FieldLabel>
              <Input
                id="client-company"
                autoComplete="organization"
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.company_name}
                {...register('company_name')}
              />
              {errors.company_name ? (
                <FieldError>{errors.company_name.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="client-cif">CIF / Tax ID</FieldLabel>
              <Input
                id="client-cif"
                disabled={isView || isSubmitting}
                {...register('cif')}
              />
              {errors.cif ? (
                <FieldError>{errors.cif.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="client-street">Street</FieldLabel>
              <Input
                id="client-street"
                autoComplete="street-address"
                disabled={isView || isSubmitting}
                {...register('street')}
              />
              {errors.street ? (
                <FieldError>{errors.street.message}</FieldError>
              ) : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="client-postal">Postal code</FieldLabel>
                <Input
                  id="client-postal"
                  autoComplete="postal-code"
                  disabled={isView || isSubmitting}
                  {...register('postal_code')}
                />
                {errors.postal_code ? (
                  <FieldError>{errors.postal_code.message}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="client-city">City</FieldLabel>
                <Input
                  id="client-city"
                  autoComplete="address-level2"
                  disabled={isView || isSubmitting}
                  {...register('city')}
                />
                {errors.city ? (
                  <FieldError>{errors.city.message}</FieldError>
                ) : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="client-province">
                Province / Region
              </FieldLabel>
              <Input
                id="client-province"
                autoComplete="address-level1"
                disabled={isView || isSubmitting}
                {...register('province')}
              />
              {errors.province ? (
                <FieldError>{errors.province.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="client-source">Source</FieldLabel>
              <Input
                id="client-source"
                disabled={isView || isSubmitting}
                {...register('source')}
              />
              {errors.source ? (
                <FieldError>{errors.source.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="client-comments">Comments</FieldLabel>
              <textarea
                id="client-comments"
                disabled={isView || isSubmitting}
                rows={4}
                className={cn(
                  'min-h-[88px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'
                )}
                aria-invalid={!!errors.comments}
                {...register('comments')}
              />
              {errors.comments ? (
                <FieldError>{errors.comments.message}</FieldError>
              ) : null}
            </Field>
            </FieldGroup>
          </form>
        </div>
        <DialogFooter>
          {isView ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="client-form"
                disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
