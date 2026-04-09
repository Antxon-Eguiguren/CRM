import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import {
  insertContact,
  SELECT_CLIENTS_FOR_PICKER,
} from '@/lib/supabase-queries';
import type { Client, Contact } from '@/lib/types';
import { supabase } from '@/supabaseClient';

const NO_CLIENT = '__none__';

const contactFormSchema = z.object({
  client_id: z.string(),
  name: z.string().min(1, 'Name is required'),
  company: z.string(),
  email: z.string(),
  personal_phone: z.string(),
  work_phone: z.string(),
  position: z.string(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

type ContactFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSaved: () => void;
  readOnly?: boolean;
};

function toNullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
  readOnly = false,
}: ContactFormDialogProps) {
  const { user } = useAuth();
  const isEdit = Boolean(contact);
  const isView = readOnly && Boolean(contact);
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name'>[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      client_id: NO_CLIENT,
      name: '',
      company: '',
      email: '',
      personal_phone: '',
      work_phone: '',
      position: '',
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (!open || !user) return;
    setClientsLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(SELECT_CLIENTS_FOR_PICKER)
        .order('name', { ascending: true });
      if (error) {
        toast.error(error.message);
        setClients([]);
      } else {
        setClients((data as Pick<Client, 'id' | 'name'>[] | null) ?? []);
      }
      setClientsLoading(false);
    })();
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    reset({
      client_id: contact?.client_id ?? NO_CLIENT,
      name: contact?.name ?? '',
      company: contact?.company ?? '',
      email: contact?.email ?? '',
      personal_phone: contact?.personal_phone ?? '',
      work_phone: contact?.work_phone ?? '',
      position: contact?.position ?? '',
    });
  }, [open, contact, reset]);

  async function onSubmit(values: ContactFormValues) {
    if (isView) return;
    if (!user) {
      toast.error('You must be signed in.');
      return;
    }

    const payload = {
      client_id: values.client_id === NO_CLIENT ? null : values.client_id,
      name: values.name.trim(),
      company: toNullIfEmpty(values.company),
      email: toNullIfEmpty(values.email),
      personal_phone: toNullIfEmpty(values.personal_phone),
      work_phone: toNullIfEmpty(values.work_phone),
      position: toNullIfEmpty(values.position),
    };

    if (isEdit && contact) {
      const { error } = await supabase
        .from('contacts')
        .update({
          client_id: payload.client_id,
          name: payload.name,
          company: payload.company,
          email: payload.email,
          personal_phone: payload.personal_phone,
          work_phone: payload.work_phone,
          position: payload.position,
        })
        .eq('id', contact.id);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Contact updated');
    } else {
      const { error } = await supabase
        .from('contacts')
        .insert(insertContact(user.id, payload));

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Contact created');
    }

    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {isView
              ? 'Contact details'
              : isEdit
              ? 'Edit contact'
              : 'New contact'}
          </DialogTitle>
        </DialogHeader>
        <form
          id="contact-form"
          onSubmit={(e) => {
            if (isView) {
              e.preventDefault();
              return;
            }
            void handleSubmit(onSubmit)(e);
          }}>
          <FieldGroup className="gap-4 py-1">
            <Field>
              <FieldLabel htmlFor="contact-client">Client</FieldLabel>
              {clientsLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Controller
                  name="client_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={
                        field.value === NO_CLIENT || !field.value
                          ? NO_CLIENT
                          : field.value
                      }
                      onValueChange={field.onChange}
                      disabled={isView || isSubmitting}>
                      <SelectTrigger
                        id="contact-client"
                        className="w-full"
                        aria-invalid={!!errors.client_id}>
                        <SelectValue placeholder="No client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CLIENT}>No client</SelectItem>
                        {clients.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {errors.client_id ? (
                <FieldError>{errors.client_id.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-name">Name</FieldLabel>
              <Input
                id="contact-name"
                autoComplete="name"
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name ? (
                <FieldError>{errors.name.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-company">Company</FieldLabel>
              <Input
                id="contact-company"
                disabled={isView || isSubmitting}
                {...register('company')}
              />
              {errors.company ? (
                <FieldError>{errors.company.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-position">Position</FieldLabel>
              <Input
                id="contact-position"
                disabled={isView || isSubmitting}
                {...register('position')}
              />
              {errors.position ? (
                <FieldError>{errors.position.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-email">Email</FieldLabel>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                disabled={isView || isSubmitting}
                {...register('email')}
              />
              {errors.email ? (
                <FieldError>{errors.email.message}</FieldError>
              ) : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-personal-phone">
                  Personal phone
                </FieldLabel>
                <Input
                  id="contact-personal-phone"
                  type="tel"
                  autoComplete="tel"
                  disabled={isView || isSubmitting}
                  {...register('personal_phone')}
                />
                {errors.personal_phone ? (
                  <FieldError>{errors.personal_phone.message}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-work-phone">Work phone</FieldLabel>
                <Input
                  id="contact-work-phone"
                  type="tel"
                  disabled={isView || isSubmitting}
                  {...register('work_phone')}
                />
                {errors.work_phone ? (
                  <FieldError>{errors.work_phone.message}</FieldError>
                ) : null}
              </Field>
            </div>
          </FieldGroup>
        </form>
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
                form="contact-form"
                disabled={isSubmitting || clientsLoading}>
                {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
