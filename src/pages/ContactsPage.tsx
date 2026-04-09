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
import { SELECT_CONTACTS_WITH_CLIENT } from '@/lib/supabase-queries';
import type { Contact, ContactWithClient } from '@/lib/types';
import { supabase } from '@/supabaseClient';
import { ContactFormDialog } from '@/pages/ContactFormDialog';

type SortKey = 'name' | 'client' | 'company' | 'email' | 'personal_phone' | 'work_phone' | 'position';
type SortDir = 'asc' | 'desc';

const CONTACTS_TABLE_DEFAULT_WIDTHS: Record<string, number> = {
  name: 168,
  client: 152,
  company: 136,
  position: 128,
  email: 200,
  personal_phone: 132,
  work_phone: 132,
  actions: 56,
};

function matchesMultiClient(selected: string[], clientId: string | null): boolean {
  if (selected.length === 0) return true;
  const hasEmpty = selected.includes(TABLE_FILTER_EMPTY);
  const ids = selected.filter((s) => s !== TABLE_FILTER_EMPTY);
  if (!clientId) return hasEmpty;
  return ids.includes(clientId);
}

export default function ContactsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ContactWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [filterClientIds, setFilterClientIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { getWidth, createResizePointerDown, tdStyle, thStyle, minWidthPx } = useResizableTableColumns(
    'erp-table-widths-contacts',
    CONTACTS_TABLE_DEFAULT_WIDTHS,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ContactWithClient | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select(SELECT_CONTACTS_WITH_CLIENT)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as ContactWithClient[] | null) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientFilterMeta = useMemo(() => {
    const map = new Map<string, string>();
    let hasNoClient = false;
    for (const r of rows) {
      if (!r.client_id) hasNoClient = true;
      else map.set(r.client_id, r.clients?.name ?? '—');
    }
    const options = [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    return { options, hasNoClient };
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
      list = list.filter((r) => {
        const name = r.name.toLowerCase();
        const company = (r.company ?? '').toLowerCase();
        const email = (r.email ?? '').toLowerCase();
        const personal = (r.personal_phone ?? '').toLowerCase();
        const work = (r.work_phone ?? '').toLowerCase();
        const position = (r.position ?? '').toLowerCase();
        const clientName = (r.clients?.name ?? '').toLowerCase();
        return (
          name.includes(q) ||
          company.includes(q) ||
          email.includes(q) ||
          personal.includes(q) ||
          work.includes(q) ||
          position.includes(q) ||
          clientName.includes(q)
        );
      });
    }

    list = list.filter((r) => matchesMultiClient(filterClientIds, r.client_id));

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'client':
          cmp = (a.clients?.name ?? '').localeCompare(b.clients?.name ?? '');
          break;
        case 'company':
          cmp = (a.company ?? '').localeCompare(b.company ?? '');
          break;
        case 'email':
          cmp = (a.email ?? '').localeCompare(b.email ?? '');
          break;
        case 'personal_phone':
          cmp = (a.personal_phone ?? '').localeCompare(b.personal_phone ?? '');
          break;
        case 'work_phone':
          cmp = (a.work_phone ?? '').localeCompare(b.work_phone ?? '');
          break;
        case 'position':
          cmp = (a.position ?? '').localeCompare(b.position ?? '');
          break;
        default:
          break;
      }
      return cmp * dir;
    });
  }, [rows, search, sortKey, sortDir, filterClientIds]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / TABLE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, filterClientIds]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginatedRows = filteredSorted.slice(
    (pageSafe - 1) * TABLE_PAGE_SIZE,
    pageSafe * TABLE_PAGE_SIZE,
  );

  const filtersActive = filterClientIds.length > 0;

  function openCreate() {
    setEditing(null);
    setFormReadOnly(false);
    setFormOpen(true);
  }

  function openEdit(c: ContactWithClient) {
    const { clients, ...contact } = c;
    void clients;
    setEditing(contact);
    setFormReadOnly(false);
    setFormOpen(true);
  }

  function openView(c: ContactWithClient) {
    const { clients, ...contact } = c;
    void clients;
    setEditing(contact);
    setFormReadOnly(true);
    setFormOpen(true);
  }

  function openDelete(c: ContactWithClient) {
    setDeleting(c);
    setDeleteOpen(true);
  }

  function exportCsv() {
    const headers = ['Name', 'Client', 'Company', 'Position', 'Email', 'Personal phone', 'Work phone'];
    const dataRows = filteredSorted.map((c) => [
      c.name,
      c.clients?.name ?? '',
      c.company ?? '',
      c.position ?? '',
      c.email ?? '',
      c.personal_phone ?? '',
      c.work_phone ?? '',
    ]);
    downloadCsvFile(
      `contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv([headers, ...dataRows]),
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const { error } = await supabase.from('contacts').delete().eq('id', deleting.id);
    setDeletePending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Contact deleted');
    setDeleteOpen(false);
    setDeleting(null);
    void load();
  }

  const colCount = 8;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} disabled={loading || filteredSorted.length === 0}>
            <DownloadIcon className="size-4" />
            Export CSV
          </Button>
          <Button type="button" onClick={openCreate}>
            <PlusIcon className="size-4" />
            New contact
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Input
          placeholder="Search by name, client, company, email, phones, or position…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 w-full sm:flex-1 sm:max-w-none"
          aria-label="Search contacts"
        />
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${filteredSorted.length} contact${filteredSorted.length === 1 ? '' : 's'}`}
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
                  label="Client"
                  column="client"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  filter={{
                    mode: 'multi',
                    value: filterClientIds,
                    onChange: setFilterClientIds,
                    options: clientFilterMeta.options,
                    includeEmptyOption: clientFilterMeta.hasNoClient,
                  }}
                  columnResize={{
                    widthPx: getWidth('client'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('client'),
                  }}
                />
                <TableSortFilterHead
                  label="Company"
                  column="company"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('company'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('company'),
                  }}
                />
                <TableSortFilterHead
                  label="Position"
                  column="position"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('position'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('position'),
                  }}
                />
                <TableSortFilterHead
                  label="Email"
                  column="email"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('email'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('email'),
                  }}
                />
                <TableSortFilterHead
                  label="Personal phone"
                  column="personal_phone"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('personal_phone'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('personal_phone'),
                  }}
                />
                <TableSortFilterHead
                  label="Work phone"
                  column="work_phone"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  columnResize={{
                    widthPx: getWidth('work_phone'),
                    minWidthPx,
                    onResizePointerDown: createResizePointerDown('work_phone'),
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
                      ? 'No contacts match your search or filters.'
                      : 'No contacts yet. Create one to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => openView(c)}
                  >
                    <TableCell className="truncate font-medium" style={tdStyle('name')}>
                      {c.name}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('client')}>
                      {c.clients?.name ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('company')}>
                      {c.company ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('position')}>
                      {c.position ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('email')}>
                      {c.email ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('personal_phone')}>
                      {c.personal_phone ?? '—'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" style={tdStyle('work_phone')}>
                      {c.work_phone ?? '—'}
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

      <ContactFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormReadOnly(false);
        }}
        contact={editing}
        readOnly={formReadOnly}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleting(null);
        }}
        title="Delete contact?"
        description={
          deleting ? (
            <>
              This will permanently remove <strong>{deleting.name}</strong>.
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
