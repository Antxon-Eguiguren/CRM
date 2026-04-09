import { useCallback, useEffect, useMemo, useState } from 'react';
import { DownloadIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
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
import type { Client } from '@/lib/types';
import { supabase } from '@/supabaseClient';
import { ClientFormDialog } from '@/pages/ClientFormDialog';

type SortKey =
  | 'name'
  | 'company_name'
  | 'cif'
  | 'street'
  | 'postal_code'
  | 'city'
  | 'province'
  | 'comments'
  | 'source';
type SortDir = 'asc' | 'desc';

function distinctStringField(
  rows: Client[],
  get: (r: Client) => string | null | undefined,
): { options: string[]; hasEmpty: boolean } {
  const set = new Set<string>();
  let hasEmpty = false;
  for (const r of rows) {
    const v = get(r)?.trim();
    if (!v) hasEmpty = true;
    else set.add(v);
  }
  return { options: [...set].sort((a, b) => a.localeCompare(b)), hasEmpty };
}

const CLIENT_TABLE_DEFAULT_WIDTHS: Record<string, number> = {
  name: 176,
  company_name: 148,
  cif: 104,
  source: 128,
  street: 168,
  postal_code: 96,
  city: 120,
  province: 120,
  comments: 200,
  actions: 56,
};

function matchesMultiSource(selected: string[], value: string | null | undefined): boolean {
  if (selected.length === 0) return true;
  const hasEmpty = selected.includes(TABLE_FILTER_EMPTY);
  const vals = selected.filter((s) => s !== TABLE_FILTER_EMPTY);
  const v = value?.trim() ?? '';
  if (!v) return hasEmpty;
  return vals.includes(v);
}

export default function ClientsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [filterSources, setFilterSources] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { getWidth, createResizePointerDown, tdStyle, thStyle, minWidthPx } = useResizableTableColumns(
    'erp-table-widths-clients',
    CLIENT_TABLE_DEFAULT_WIDTHS,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as Client[] | null) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceMeta = useMemo(() => distinctStringField(rows, (r) => r.source), [rows]);

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
      list = list.filter((r) => {
        const name = r.name.toLowerCase();
        const company = (r.company_name ?? '').toLowerCase();
        const cif = (r.cif ?? '').toLowerCase();
        const street = (r.street ?? '').toLowerCase();
        const postal = (r.postal_code ?? '').toLowerCase();
        const city = (r.city ?? '').toLowerCase();
        const province = (r.province ?? '').toLowerCase();
        const comments = (r.comments ?? '').toLowerCase();
        const source = (r.source ?? '').toLowerCase();
        return (
          name.includes(q) ||
          company.includes(q) ||
          cif.includes(q) ||
          street.includes(q) ||
          postal.includes(q) ||
          city.includes(q) ||
          province.includes(q) ||
          comments.includes(q) ||
          source.includes(q)
        );
      });
    }

    list = list.filter((r) => matchesMultiSource(filterSources, r.source));

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'company_name':
          cmp = (a.company_name ?? '').localeCompare(b.company_name ?? '');
          break;
        case 'cif':
          cmp = (a.cif ?? '').localeCompare(b.cif ?? '');
          break;
        case 'street':
          cmp = (a.street ?? '').localeCompare(b.street ?? '');
          break;
        case 'postal_code':
          cmp = (a.postal_code ?? '').localeCompare(b.postal_code ?? '');
          break;
        case 'city':
          cmp = (a.city ?? '').localeCompare(b.city ?? '');
          break;
        case 'province':
          cmp = (a.province ?? '').localeCompare(b.province ?? '');
          break;
        case 'comments':
          cmp = (a.comments ?? '').localeCompare(b.comments ?? '');
          break;
        case 'source':
          cmp = (a.source ?? '').localeCompare(b.source ?? '');
          break;
        default:
          break;
      }
      return cmp * dir;
    });
  }, [rows, search, sortKey, sortDir, filterSources]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / TABLE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, filterSources]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginatedRows = filteredSorted.slice(
    (pageSafe - 1) * TABLE_PAGE_SIZE,
    pageSafe * TABLE_PAGE_SIZE,
  );

  const filtersActive = filterSources.length > 0;

  function exportCsv() {
    const headers = [
      'Name',
      'Company',
      'CIF',
      'Source',
      'Street',
      'Postal code',
      'City',
      'Province',
      'Comments',
    ];
    const dataRows = filteredSorted.map((c) => [
      c.name,
      c.company_name ?? '',
      c.cif ?? '',
      c.source ?? '',
      c.street ?? '',
      c.postal_code ?? '',
      c.city ?? '',
      c.province ?? '',
      c.comments ?? '',
    ]);
    downloadCsvFile(
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv([headers, ...dataRows]),
    );
  }

  function openCreate() {
    setEditing(null);
    setFormReadOnly(false);
    setFormOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setFormReadOnly(false);
    setFormOpen(true);
  }

  function openView(c: Client) {
    setEditing(c);
    setFormReadOnly(true);
    setFormOpen(true);
  }

  function openDelete(c: Client) {
    setDeleting(c);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const { error } = await supabase.from('clients').delete().eq('id', deleting.id);
    setDeletePending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Client deleted');
    setDeleteOpen(false);
    setDeleting(null);
    void load();
  }

  const colCount = 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} disabled={loading || filteredSorted.length === 0}>
            <DownloadIcon className="size-4" />
            Export CSV
          </Button>
          <Button type="button" onClick={openCreate}>
            <PlusIcon className="size-4" />
            New client
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Input
          placeholder="Search by name, company, CIF, address fields, source, or comments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 w-full sm:flex-1 sm:max-w-none"
          aria-label="Search clients"
        />
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${filteredSorted.length} client${filteredSorted.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableSortFilterHead
                  label="Name"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('name'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('name'),
                  }}
                />
                <TableSortFilterHead
                  label="Company"
                  column="company_name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('company_name'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('company_name'),
                  }}
                />
                <TableSortFilterHead
                  label="CIF"
                  column="cif"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('cif'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('cif'),
                  }}
                />
                <TableSortFilterHead
                  label="Source"
                  column="source"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  filter={{
                    mode: 'multi',
                    value: filterSources,
                    onChange: setFilterSources,
                    options: sourceMeta.options.map((v) => ({ value: v, label: v })),
                    includeEmptyOption: sourceMeta.hasEmpty,
                  }}
                  columnResize={{
                    widthPx: getWidth('source'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('source'),
                  }}
                />
                <TableSortFilterHead
                  label="Street"
                  column="street"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('street'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('street'),
                  }}
                />
                <TableSortFilterHead
                  label="Postal"
                  column="postal_code"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('postal_code'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('postal_code'),
                  }}
                />
                <TableSortFilterHead
                  label="City"
                  column="city"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('city'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('city'),
                  }}
                />
                <TableSortFilterHead
                  label="Province"
                  column="province"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('province'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('province'),
                  }}
                />
                <TableSortFilterHead
                  label="Comments"
                  column="comments"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('comments'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('comments'),
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
                      ? 'No clients match your search or filters.'
                      : 'No clients yet. Create one to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => openView(c)}
                  >
                    <TableCell className="truncate font-medium" style={tdStyle('name')} title={c.name}>
                      {c.name}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('company_name')}>
                      {c.company_name ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('cif')}>
                      {c.cif ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('source')}>
                      {c.source ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('street')} title={c.street ?? undefined}>
                      {c.street ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('postal_code')}>
                      {c.postal_code ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('city')} title={c.city ?? undefined}>
                      {c.city ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('province')} title={c.province ?? undefined}>
                      {c.province ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('comments')} title={c.comments ?? undefined}>
                      {c.comments?.trim() ? c.comments : '—'}
                    </TableCell>
                    <TableCell className="text-right" style={tdStyle('actions')} onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(c)}>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => openDelete(c)}>
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

      <ClientFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormReadOnly(false);
        }}
        client={editing}
        readOnly={formReadOnly}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleting(null);
        }}
        title="Delete client?"
        description={
          deleting ? (
            <>
              This will permanently remove <strong>{deleting.name}</strong> and related contacts and projects.
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
