import { Button } from '@/components/ui/button';

export const TABLE_PAGE_SIZE = 15;

type TablePaginationBarProps = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function TablePaginationBar({
  page,
  pageSize = TABLE_PAGE_SIZE,
  total,
  onPageChange,
}: TablePaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (effectivePage - 1) * pageSize + 1;
  const end = Math.min(effectivePage * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        {total === 0
          ? 'No rows'
          : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={effectivePage <= 1}
          onClick={() => onPageChange(effectivePage - 1)}
        >
          Previous
        </Button>
        <span className="tabular-nums px-1">
          Page {effectivePage} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={effectivePage >= totalPages}
          onClick={() => onPageChange(effectivePage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
