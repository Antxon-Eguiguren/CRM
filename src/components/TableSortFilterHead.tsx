import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ListFilterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableColumnResizeHandle } from '@/hooks/use-resizable-table-columns';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDir = 'asc' | 'desc';

/** Sentinel: filter rows with an empty / null field. */
export const TABLE_FILTER_EMPTY = '__empty__';

type FilterOption = { value: string; label: string };

type SingleFilter = {
  mode?: 'single';
  value: string | null;
  onChange: (v: string | null) => void;
  options: FilterOption[];
  includeEmptyOption?: boolean;
};

type MultiFilter = {
  mode: 'multi';
  value: string[];
  onChange: (v: string[]) => void;
  options: FilterOption[];
  includeEmptyOption?: boolean;
};

export type TableColumnFilter = SingleFilter | MultiFilter;

type TableSortFilterHeadProps<T extends string> = {
  label: string;
  column: T;
  sortKey: T;
  sortDir: SortDir;
  onSort: (key: T) => void;
  filter?: TableColumnFilter;
  /** Optional column resize (drag handle on the right edge). */
  columnResize?: {
    widthPx: number;
    minWidthPx?: number;
    onResizePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  };
};

const ALL = '__all__';

function isMulti(f: TableColumnFilter): f is MultiFilter {
  return f.mode === 'multi';
}

export function TableSortFilterHead<T extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  filter,
  columnResize,
}: TableSortFilterHeadProps<T>) {
  const activeSort = sortKey === column;
  const filterOpen =
    filter != null && (filter.options.length > 0 || filter.includeEmptyOption);
  const filterActive = filter
    ? isMulti(filter)
      ? filter.value.length > 0
      : filter.value != null
    : false;

  return (
    <TableHead
      className={cn('align-bottom', columnResize && 'relative')}
      style={
        columnResize
          ? {
              width: columnResize.widthPx,
              minWidth: columnResize.minWidthPx ?? 64,
              maxWidth: columnResize.widthPx,
            }
          : undefined
      }
    >
      <div className={cn('flex items-end gap-0.5', columnResize && 'pr-2')}>
        <button
          type="button"
          className="inline-flex min-w-0 flex-1 items-center gap-1 py-1 text-left font-medium hover:text-foreground"
          onClick={() => onSort(column)}
          aria-sort={
            activeSort ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
          }
        >
          <span className="truncate">{label}</span>
          {activeSort ? (
            sortDir === 'asc' ? (
              <ArrowUpIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
            ) : (
              <ArrowDownIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
            )
          ) : (
            <ArrowUpDownIcon className="size-3.5 shrink-0 opacity-40" aria-hidden />
          )}
        </button>
        {filterOpen && filter ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  'size-7 shrink-0 text-muted-foreground hover:text-foreground',
                  filterActive && 'bg-muted/70 text-foreground',
                )}
                aria-label={`Filter by ${label}`}
              >
                <ListFilterIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 min-w-44 overflow-y-auto">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {label}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isMulti(filter) ? (
                <>
                  {filter.includeEmptyOption ? (
                    <DropdownMenuCheckboxItem
                      checked={filter.value.includes(TABLE_FILTER_EMPTY)}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        const next = new Set(filter.value);
                        if (on) next.add(TABLE_FILTER_EMPTY);
                        else next.delete(TABLE_FILTER_EMPTY);
                        filter.onChange([...next]);
                      }}
                    >
                      (Empty)
                    </DropdownMenuCheckboxItem>
                  ) : null}
                  {filter.options.map((o) => (
                    <DropdownMenuCheckboxItem
                      key={o.value}
                      checked={filter.value.includes(o.value)}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        const next = new Set(filter.value);
                        if (on) next.add(o.value);
                        else next.delete(o.value);
                        filter.onChange([...next]);
                      }}
                    >
                      <span className="truncate" title={o.label}>
                        {o.label}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onSelect={(e) => {
                      e.preventDefault();
                      filter.onChange([]);
                    }}
                  >
                    Clear filters
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuRadioGroup
                  value={filter.value ?? ALL}
                  onValueChange={(v) => {
                    if (v === ALL) filter.onChange(null);
                    else filter.onChange(v);
                  }}
                >
                  <DropdownMenuRadioItem value={ALL}>All</DropdownMenuRadioItem>
                  {filter.includeEmptyOption ? (
                    <DropdownMenuRadioItem value={TABLE_FILTER_EMPTY}>
                      (Empty)
                    </DropdownMenuRadioItem>
                  ) : null}
                  {filter.options.map((o) => (
                    <DropdownMenuRadioItem key={o.value} value={o.value}>
                      <span className="truncate" title={o.label}>
                        {o.label}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {columnResize ? (
        <TableColumnResizeHandle onPointerDown={columnResize.onResizePointerDown} />
      ) : null}
    </TableHead>
  );
}
