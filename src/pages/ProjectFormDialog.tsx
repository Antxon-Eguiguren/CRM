import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
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
  generateNextReference,
  insertProject,
  SELECT_CLIENTS_FOR_PICKER,
} from '@/lib/supabase-queries';
import type {
  Client,
  Project,
  ProjectCategory,
  ProjectStatus,
} from '@/lib/types';
import { PROJECT_CATEGORY_VALUES, projectCategoryLabel } from '@/lib/types';
import { supabase } from '@/supabaseClient';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const projectCategorySchema = z.enum(
  PROJECT_CATEGORY_VALUES as unknown as [ProjectCategory, ...ProjectCategory[]]
);

const projectFormSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  reference: z.string().optional(),
  project_name: z.string(),
  project_type: projectCategorySchema,
  status: z.enum(['proposal', 'planned', 'in_progress', 'completed']),
  start_date: z.string(),
  end_date: z.string(),
  budget: z
    .string()
    .transform((s) => {
      const t = s.trim();
      if (t === '') return 0;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : NaN;
    })
    .pipe(z.number().min(0, 'Must be 0 or more')),
  invoiced: z
    .string()
    .transform((s) => {
      const t = s.trim();
      if (t === '') return 0;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : NaN;
    })
    .pipe(z.number().min(0, 'Must be 0 or more')),
  paid: z
    .string()
    .transform((s) => {
      const t = s.trim();
      if (t === '') return 0;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : NaN;
    })
    .pipe(z.number().min(0, 'Must be 0 or more')),
});

type ProjectFormValues = z.input<typeof projectFormSchema>;
type ProjectFormOutput = z.output<typeof projectFormSchema>;

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSaved: () => void;
  readOnly?: boolean;
};

function dateToInput(s: string | null | undefined) {
  if (!s) return '';
  return s.slice(0, 10);
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
  readOnly = false,
}: ProjectFormDialogProps) {
  const { user } = useAuth();
  const isEdit = Boolean(project);
  const isView = readOnly && Boolean(project);
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name'>[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const form = useForm<ProjectFormValues, unknown, ProjectFormOutput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      client_id: '',
      reference: '',
      project_name: '',
      project_type: 'consultancy',
      status: 'planned',
      start_date: '',
      end_date: '',
      budget: '0',
      invoiced: '0',
      paid: '0',
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
    const pt = project?.project_type;
    const validType =
      pt && PROJECT_CATEGORY_VALUES.includes(pt as ProjectCategory)
        ? (pt as ProjectCategory)
        : 'consultancy';
    reset({
      client_id: project?.client_id ?? '',
      reference: project?.reference ?? '',
      project_name: project?.project_name ?? '',
      project_type: validType,
      status: project?.status ?? 'planned',
      start_date: dateToInput(project?.start_date),
      end_date: dateToInput(project?.end_date),
      budget: project != null ? String(project.budget) : '0',
      invoiced: project != null ? String(project.invoiced) : '0',
      paid: project != null ? String(project.paid) : '0',
    });
  }, [open, project, reset]);

  async function onSubmit(values: ProjectFormOutput) {
    if (isView) return;
    if (!user) {
      toast.error('You must be signed in.');
      return;
    }

    const startTrim = values.start_date.trim();
    const endTrim = values.end_date.trim();

    const basePayload = {
      client_id: values.client_id,
      project_name: values.project_name.trim(),
      project_type: values.project_type,
      status: values.status,
      start_date: startTrim === '' ? null : startTrim,
      end_date: endTrim === '' ? null : endTrim,
      budget: values.budget,
      invoiced: values.invoiced,
      paid: values.paid,
    };

    if (isEdit && project) {
      const ref = values.reference?.trim();
      if (!ref) {
        toast.error('Reference is required');
        return;
      }
      const payload = { ...basePayload, reference: ref };
      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', project.id);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Project updated');
    } else {
      let reference: string;
      try {
        reference = await generateNextReference();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Could not generate reference'
        );
        return;
      }
      const payload = { ...basePayload, reference };
      const { error } = await supabase
        .from('projects')
        .insert(insertProject(user.id, payload));

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Project created');
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
              ? 'Project details'
              : isEdit
              ? 'Edit project'
              : 'New project'}
          </DialogTitle>
        </DialogHeader>
        <form
          id="project-form"
          onSubmit={(e) => {
            if (isView) {
              e.preventDefault();
              return;
            }
            void handleSubmit(onSubmit)(e);
          }}>
          <FieldGroup className="gap-4 py-1">
            <Field>
              <FieldLabel htmlFor="project-client">Client</FieldLabel>
              {clientsLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Controller
                  name="client_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={isView || isSubmitting || clients.length === 0}>
                      <SelectTrigger
                        id="project-client"
                        className="w-full"
                        aria-invalid={!!errors.client_id}>
                        <SelectValue
                          placeholder={
                            clients.length === 0
                              ? 'No clients yet'
                              : 'Select client'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
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
            {isEdit ? (
              <Field>
                <FieldLabel htmlFor="project-reference">Reference</FieldLabel>
                <Input
                  id="project-reference"
                  autoComplete="off"
                  disabled={isView || isSubmitting}
                  aria-invalid={!!errors.reference}
                  {...register('reference')}
                />
                <p className="text-muted-foreground text-xs">
                  Auto-generated when created. Change only if needed.
                </p>
                {errors.reference ? (
                  <FieldError>{errors.reference.message}</FieldError>
                ) : null}
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="project-name">Project name</FieldLabel>
              <Input
                id="project-name"
                autoComplete="off"
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.project_name}
                {...register('project_name')}
              />
              {errors.project_name ? (
                <FieldError>{errors.project_name.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="project-type">Project type</FieldLabel>
              <Controller
                name="project_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isView || isSubmitting}>
                    <SelectTrigger
                      id="project-type"
                      className="w-full"
                      aria-invalid={!!errors.project_type}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_CATEGORY_VALUES.map((v) => (
                        <SelectItem
                          key={v}
                          value={v}>
                          {projectCategoryLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.project_type ? (
                <FieldError>{errors.project_type.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="project-status">Status</FieldLabel>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isView || isSubmitting}>
                    <SelectTrigger
                      id="project-status"
                      className="w-full"
                      aria-invalid={!!errors.status}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status ? (
                <FieldError>{errors.status.message}</FieldError>
              ) : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="project-start">Start date</FieldLabel>
                <Input
                  id="project-start"
                  type="date"
                  disabled={isView || isSubmitting}
                  {...register('start_date')}
                />
                {errors.start_date ? (
                  <FieldError>{errors.start_date.message}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="project-end">End date</FieldLabel>
                <Input
                  id="project-end"
                  type="date"
                  disabled={isView || isSubmitting}
                  {...register('end_date')}
                />
                {errors.end_date ? (
                  <FieldError>{errors.end_date.message}</FieldError>
                ) : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="project-budget">Budget</FieldLabel>
              <Input
                id="project-budget"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.budget}
                {...register('budget')}
              />
              {errors.budget ? (
                <FieldError>{errors.budget.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="project-invoiced">Invoiced</FieldLabel>
              <Input
                id="project-invoiced"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.invoiced}
                {...register('invoiced')}
              />
              {errors.invoiced ? (
                <FieldError>{errors.invoiced.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="project-paid">Paid</FieldLabel>
              <Input
                id="project-paid"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                disabled={isView || isSubmitting}
                aria-invalid={!!errors.paid}
                {...register('paid')}
              />
              {errors.paid ? (
                <FieldError>{errors.paid.message}</FieldError>
              ) : null}
            </Field>
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
                form="project-form"
                disabled={
                  isSubmitting || clientsLoading || clients.length === 0
                }>
                {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
