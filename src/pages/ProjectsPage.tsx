import { useCallback, useEffect, useMemo, useState } from 'react';
import { DownloadIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TablePaginationBar, TABLE_PAGE_SIZE } from '@/components/TablePaginationBar';
import { TableSortFilterHead, TABLE_FILTER_EMPTY } from '@/components/TableSortFilterHead';
import {
  TableColumnResizeHandle,
  useResizableTableColumns,
} from '@/hooks/use-resizable-table-columns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { downloadCsvFile, rowsToCsv } from '@/lib/csv';
import { SELECT_PROJECTS_WITH_CLIENT } from '@/lib/supabase-queries';
import type { Project, ProjectCategory, ProjectStatus, ProjectWithClient } from '@/lib/types';
import { PROJECT_CATEGORY_VALUES, projectCategoryLabel } from '@/lib/types';
import { supabase } from '@/supabaseClient';
import { ProjectFormDialog } from '@/pages/ProjectFormDialog';

type SortKey =
  | 'reference'
  | 'project_name'
  | 'project_type'
  | 'client'
  | 'status'
  | 'budget'
  | 'invoiced'
  | 'paid'
  | 'start_date'
  | 'end_date';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<ProjectStatus, number> = {
  proposal: 0,
  planned: 1,
  in_progress: 2,
  completed: 3,
};

function statusLabel(status: ProjectStatus) {
  switch (status) {
    case 'proposal':
      return 'Proposal';
    case 'planned':
      return 'Planned';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const label = statusLabel(status);
  if (status === 'proposal') {
    return (
      <Badge
        variant="outline"
        className="border-slate-500/35 bg-slate-500/10 font-medium text-slate-800 shadow-sm dark:border-slate-400/40 dark:bg-slate-950/50 dark:text-slate-300"
      >
        {label}
      </Badge>
    );
  }
  if (status === 'planned') {
    return (
      <Badge
        variant="outline"
        className="border-red-600/35 bg-red-500/10 font-medium text-red-800 shadow-sm dark:border-red-500/45 dark:bg-red-950/45 dark:text-red-300"
      >
        {label}
      </Badge>
    );
  }
  if (status === 'in_progress') {
    return (
      <Badge
        variant="outline"
        className="border-amber-600/40 bg-amber-400/15 font-medium text-amber-950 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/35 dark:text-amber-200"
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-600/40 bg-emerald-500/12 font-medium text-emerald-900 shadow-sm dark:border-emerald-500/45 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      {label}
    </Badge>
  );
}

function formatOptionalDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? `${s}T12:00:00` : s);
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function matchesMultiStatus(selected: string[], status: ProjectStatus): boolean {
  if (selected.length === 0) return true;
  return selected.includes(status);
}

function matchesMultiClientIds(selected: string[], clientId: string): boolean {
  if (selected.length === 0) return true;
  return selected.includes(clientId);
}

const PROJECTS_TABLE_DEFAULT_WIDTHS: Record<string, number> = {
  reference: 120,
  project_name: 240,
  project_type: 136,
  client: 160,
  status: 128,
  budget: 104,
  invoiced: 104,
  paid: 104,
  start_date: 116,
  end_date: 116,
  actions: 56,
};

function matchesMultiTypes(selected: string[], projectType: string | null | undefined): boolean {
  if (selected.length === 0) return true;
  const hasEmpty = selected.includes(TABLE_FILTER_EMPTY);
  const vals = selected.filter((s) => s !== TABLE_FILTER_EMPTY);
  const v = projectType?.trim() ?? '';
  if (!v) return hasEmpty;
  return vals.includes(v);
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProjectWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('reference');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterClientIds, setFilterClientIds] = useState<string[]>([]);
  const [filterProjectTypes, setFilterProjectTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { getWidth, createResizePointerDown, tdStyle, thStyle, minWidthPx } = useResizableTableColumns(
    'erp-table-widths-projects',
    PROJECTS_TABLE_DEFAULT_WIDTHS,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProjectWithClient | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select(SELECT_PROJECTS_WITH_CLIENT)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as ProjectWithClient[] | null) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusFilterOptions = useMemo(
    () =>
      (['proposal', 'planned', 'in_progress', 'completed'] as const).map((s) => ({
        value: s,
        label: statusLabel(s),
      })),
    [],
  );

  const typeFilterOptions = useMemo(
    () =>
      PROJECT_CATEGORY_VALUES.map((v) => ({
        value: v,
        label: projectCategoryLabel(v),
      })),
    [],
  );

  const hasEmptyProjectType = useMemo(
    () => rows.some((r) => !r.project_type?.trim()),
    [rows],
  );

  const clientFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const name = r.clients?.name?.trim() || '—';
      map.set(r.client_id, name);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [rows]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = rows.filter((r) => {
        const ref = r.reference.toLowerCase();
        const pname = (r.project_name ?? '').toLowerCase();
        const ptype = (r.project_type ? projectCategoryLabel(r.project_type as ProjectCategory) : '').toLowerCase();
        const clientName = (r.clients?.name ?? '').toLowerCase();
        const status = statusLabel(r.status).toLowerCase();
        const budgetStr = formatMoney(r.budget).toLowerCase();
        const invoicedStr = formatMoney(r.invoiced).toLowerCase();
        const paidStr = formatMoney(r.paid).toLowerCase();
        return (
          ref.includes(q) ||
          pname.includes(q) ||
          ptype.includes(q) ||
          clientName.includes(q) ||
          status.includes(q) ||
          budgetStr.includes(q) ||
          invoicedStr.includes(q) ||
          paidStr.includes(q)
        );
      });
    }

    list = list.filter((r) => matchesMultiStatus(filterStatuses, r.status));
    list = list.filter((r) => matchesMultiClientIds(filterClientIds, r.client_id));
    list = list.filter((r) => matchesMultiTypes(filterProjectTypes, r.project_type));

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'reference':
          cmp = a.reference.localeCompare(b.reference);
          break;
        case 'project_name':
          cmp = (a.project_name ?? '').localeCompare(b.project_name ?? '');
          break;
        case 'project_type':
          cmp = (a.project_type ?? '').localeCompare(b.project_type ?? '');
          break;
        case 'client':
          cmp = (a.clients?.name ?? '').localeCompare(b.clients?.name ?? '');
          break;
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'budget':
          cmp = a.budget - b.budget;
          break;
        case 'invoiced':
          cmp = a.invoiced - b.invoiced;
          break;
        case 'paid':
          cmp = a.paid - b.paid;
          break;
        case 'start_date': {
          const ta = a.start_date ? new Date(a.start_date + 'T12:00:00').getTime() : 0;
          const tb = b.start_date ? new Date(b.start_date + 'T12:00:00').getTime() : 0;
          cmp = ta - tb;
          break;
        }
        case 'end_date': {
          const ta = a.end_date ? new Date(a.end_date + 'T12:00:00').getTime() : 0;
          const tb = b.end_date ? new Date(b.end_date + 'T12:00:00').getTime() : 0;
          cmp = ta - tb;
          break;
        }
        default:
          break;
      }
      return cmp * dir;
    });
  }, [rows, search, sortKey, sortDir, filterStatuses, filterClientIds, filterProjectTypes]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / TABLE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, filterStatuses, filterClientIds, filterProjectTypes]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginatedRows = filteredSorted.slice(
    (pageSafe - 1) * TABLE_PAGE_SIZE,
    pageSafe * TABLE_PAGE_SIZE,
  );

  const filtersActive =
    filterStatuses.length > 0 || filterClientIds.length > 0 || filterProjectTypes.length > 0;

  function exportCsv() {
    const headers = [
      'Reference',
      'Project name',
      'Project type',
      'Client',
      'Status',
      'Budget',
      'Invoiced',
      'Paid',
      'Start',
      'End',
    ];
    const dataRows = filteredSorted.map((p) => [
      p.reference,
      p.project_name ?? '',
      p.project_type ? projectCategoryLabel(p.project_type as ProjectCategory) : '',
      p.clients?.name ?? '',
      statusLabel(p.status),
      formatMoney(p.budget),
      formatMoney(p.invoiced),
      formatMoney(p.paid),
      p.start_date ? formatOptionalDate(p.start_date) : '',
      p.end_date ? formatOptionalDate(p.end_date) : '',
    ]);
    downloadCsvFile(
      `projects-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv([headers, ...dataRows]),
    );
  }

  function openCreate() {
    setEditing(null);
    setFormReadOnly(false);
    setFormOpen(true);
  }

  function openEdit(p: ProjectWithClient) {
    const { clients, ...project } = p;
    void clients;
    setEditing(project);
    setFormReadOnly(false);
    setFormOpen(true);
  }

  function openView(p: ProjectWithClient) {
    const { clients, ...project } = p;
    void clients;
    setEditing(project);
    setFormReadOnly(true);
    setFormOpen(true);
  }

  function openDelete(p: ProjectWithClient) {
    setDeleting(p);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const { error } = await supabase.from('projects').delete().eq('id', deleting.id);
    setDeletePending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Project deleted');
    setDeleteOpen(false);
    setDeleting(null);
    void load();
  }

  const colCount = 11;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-semibold tracking-tight">Projects</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} disabled={loading || filteredSorted.length === 0}>
            <DownloadIcon className="size-4" />
            Export CSV
          </Button>
          <Button type="button" onClick={openCreate}>
            <PlusIcon className="size-4" />
            New project
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Input
          placeholder="Search by reference, name, type, client, status, budget, invoiced, or paid…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 w-full sm:flex-1 sm:max-w-none"
          aria-label="Search projects"
        />
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${filteredSorted.length} project${filteredSorted.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableSortFilterHead
                  label="Reference"
                  column="reference"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('reference'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('reference'),
                  }}
                />
                <TableSortFilterHead
                  label="Name"
                  column="project_name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('project_name'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('project_name'),
                  }}
                />
                <TableSortFilterHead
                  label="Type"
                  column="project_type"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  filter={{
                    mode: 'multi',
                    value: filterProjectTypes,
                    onChange: setFilterProjectTypes,
                    options: typeFilterOptions,
                    includeEmptyOption: hasEmptyProjectType,
                  }}
                  columnResize={{
                    widthPx: getWidth('project_type'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('project_type'),
                  }}
                />
                <TableSortFilterHead
                  label="Client"
                  column="client"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  filter={{
                    mode: 'multi',
                    value: filterClientIds,
                    onChange: setFilterClientIds,
                    options: clientFilterOptions,
                  }}
                  columnResize={{
                    widthPx: getWidth('client'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('client'),
                  }}
                />
                <TableSortFilterHead
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  filter={{
                    mode: 'multi',
                    value: filterStatuses,
                    onChange: setFilterStatuses,
                    options: statusFilterOptions,
                  }}
                  columnResize={{
                    widthPx: getWidth('status'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('status'),
                  }}
                />
                <TableSortFilterHead
                  label="Budget"
                  column="budget"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('budget'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('budget'),
                  }}
                />
                <TableSortFilterHead
                  label="Invoiced"
                  column="invoiced"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('invoiced'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('invoiced'),
                  }}
                />
                <TableSortFilterHead
                  label="Paid"
                  column="paid"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('paid'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('paid'),
                  }}
                />
                <TableSortFilterHead
                  label="Start"
                  column="start_date"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('start_date'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('start_date'),
                  }}
                />
                <TableSortFilterHead
                  label="End"
                  column="end_date"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('end_date'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('end_date'),
                  }}
                />
                <TableHead className="relative text-right align-bottom" style={thStyle('actions')}>
                  Actions
                  <TableColumnResizeHandle onPointerDown={createResizePointerDown('actions')} />
                </TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colCount}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">
                  {search.trim() || filtersActive
                    ? 'No projects match your search or filters.'
                    : 'No projects yet. Create one to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => openView(p)}
                >
                  <TableCell className="truncate font-medium" style={tdStyle('reference')}>
                    {p.reference}
                  </TableCell>
                  <TableCell
                    className="truncate text-muted-foreground"
                    style={tdStyle('project_name')}
                    title={p.project_name || undefined}
                  >
                    {p.project_name?.trim() ? p.project_name : '—'}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground" style={tdStyle('project_type')}>
                    {p.project_type ? projectCategoryLabel(p.project_type as ProjectCategory) : '—'}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground" style={tdStyle('client')}>
                    {p.clients?.name ?? '—'}
                  </TableCell>
                  <TableCell style={tdStyle('status')}>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground tabular-nums" style={tdStyle('budget')}>
                    {formatMoney(p.budget)}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground tabular-nums" style={tdStyle('invoiced')}>
                    {formatMoney(p.invoiced)}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground tabular-nums" style={tdStyle('paid')}>
                    {formatMoney(p.paid)}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground" style={tdStyle('start_date')}>
                    {formatOptionalDate(p.start_date)}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground" style={tdStyle('end_date')}>
                    {formatOptionalDate(p.end_date)}
                  </TableCell>
                  <TableCell className="text-right" style={tdStyle('actions')} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for project ${p.reference}`}
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEdit(p)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => openDelete(p)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        {!loading ? (
          <TablePaginationBar page={page} total={filteredSorted.length} onPageChange={setPage} />
        ) : null}
      </div>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormReadOnly(false);
        }}
        project={editing}
        readOnly={formReadOnly}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleting(null);
        }}
        title="Delete project?"
        description={
          deleting ? (
            <>
              This will permanently remove project <strong>{deleting.reference}</strong>.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
