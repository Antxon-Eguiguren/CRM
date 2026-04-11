import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { SELECT_PROJECTS_WITH_CLIENT } from '@/lib/supabase-queries';
import type { ProjectCategory, ProjectStatus } from '@/lib/types';
import { PROJECT_CATEGORY_VALUES, projectCategoryLabel } from '@/lib/types';
import { supabase } from '@/supabaseClient';

const BAR_TOP_N = 8;

/** Theme chart tokens — cycle slices for slight separation. */
const CHART_CYCLE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Client bars: skip the lightest token so bars read on the card. */
const CLIENT_BAR_CYCLE = [
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
] as const;

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

function formatAmount(n: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** YYYY-MM keys from `fromYm` through `toYm` inclusive. */
function monthKeysInclusive(fromYm: string, toYm: string): string[] {
  const [fy, fm] = fromYm.split('-').map(Number);
  const [ty, tm] = toYm.split('-').map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function formatMonthLabel(ym: string) {
  const d = new Date(`${ym}-01T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

type ProjectRow = {
  id: string;
  status: ProjectStatus;
  budget: number;
  invoiced: number;
  paid: number;
  project_type: string | null;
  created_at: string;
  start_date: string | null;
  clients: { name: string } | null;
};

type PieMode = 'status' | 'type';
type BillingMode = 'type' | 'client';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [pieMode, setPieMode] = useState<PieMode>('status');
  const [billingMode, setBillingMode] = useState<BillingMode>('type');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('projects')
      .select(SELECT_PROJECTS_WITH_CLIENT);

    if (error) {
      toast.error(error.message);
      setProjects([]);
      setLoading(false);
      return;
    }

    const projRows = (data ?? []) as ProjectRow[];
    setProjects(projRows);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const completedProjectCount = useMemo(
    () => projects.filter((p) => p.status === 'completed').length,
    [projects]
  );

  const totalPaid = useMemo(
    () => projects.reduce((sum, p) => sum + (Number(p.paid) || 0), 0),
    [projects]
  );

  const statusBarData = useMemo(() => {
    const acc: Record<ProjectStatus, number> = {
      proposal: 0,
      planned: 0,
      in_progress: 0,
      completed: 0,
    };
    for (const p of projects) {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
    }
    return (['proposal', 'planned', 'in_progress'] as const).map((status) => ({
      key: `status-${status}`,
      name: statusLabel(status),
      count: acc[status],
      status,
    }));
  }, [projects]);

  const typePieData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of PROJECT_CATEGORY_VALUES) counts.set(v, 0);
    counts.set('__other__', 0);
    for (const p of projects) {
      const t = p.project_type?.trim();
      if (t && PROJECT_CATEGORY_VALUES.includes(t as ProjectCategory)) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      } else {
        counts.set('__other__', (counts.get('__other__') ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        key: `type-${key}`,
        name:
          key === '__other__'
            ? 'Other / none'
            : projectCategoryLabel(key as ProjectCategory),
        value,
      }));
  }, [projects]);

  const clientBarData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const name = p.clients?.name?.trim() || 'Unknown client';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, BAR_TOP_N);
  }, [projects]);

  const billingByTypeData = useMemo(() => {
    type Bucket = {
      budget: number;
      invoiced: number;
      paid: number;
      count: number;
    };
    const sums = new Map<string, Bucket>();
    for (const v of PROJECT_CATEGORY_VALUES)
      sums.set(v, { budget: 0, invoiced: 0, paid: 0, count: 0 });
    sums.set('__other__', { budget: 0, invoiced: 0, paid: 0, count: 0 });
    for (const p of projects) {
      const t = p.project_type?.trim();
      const key =
        t && PROJECT_CATEGORY_VALUES.includes(t as ProjectCategory)
          ? t
          : '__other__';
      const b = sums.get(key)!;
      b.budget += Number(p.budget) || 0;
      b.invoiced += Number(p.invoiced) || 0;
      b.paid += Number(p.paid) || 0;
      b.count += 1;
    }
    return [...sums.entries()]
      .filter(([, v]) => v.count > 0)
      .map(([key, v]) => ({
        name:
          key === '__other__'
            ? 'Other / none'
            : projectCategoryLabel(key as ProjectCategory),
        budget: v.budget,
        invoiced: v.invoiced,
        paid: v.paid,
      }))
      .sort(
        (a, b) =>
          b.budget + b.invoiced + b.paid - (a.budget + a.invoiced + a.paid)
      );
  }, [projects]);

  const billingByClientData = useMemo(() => {
    const map = new Map<
      string,
      { budget: number; invoiced: number; paid: number }
    >();
    for (const p of projects) {
      const name = p.clients?.name?.trim() || 'Unknown client';
      const cur = map.get(name) ?? { budget: 0, invoiced: 0, paid: 0 };
      cur.budget += Number(p.budget) || 0;
      cur.invoiced += Number(p.invoiced) || 0;
      cur.paid += Number(p.paid) || 0;
      map.set(name, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        budget: v.budget,
        invoiced: v.invoiced,
        paid: v.paid,
      }))
      .sort(
        (a, b) =>
          b.budget + b.invoiced + b.paid - (a.budget + a.invoiced + a.paid)
      )
      .slice(0, BAR_TOP_N);
  }, [projects]);

  const activeBillingData =
    billingMode === 'type' ? billingByTypeData : billingByClientData;

  const billingForecastData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const raw = (p.start_date?.trim() ? p.start_date : p.created_at) ?? '';
      if (raw.length < 7) continue;
      const key = raw.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + (Number(p.budget) || 0));
    }
    if (map.size === 0) return [];
    const sortedKeys = [...map.keys()].sort();
    const from = sortedKeys[0]!;
    const to = sortedKeys[sortedKeys.length - 1]!;
    return monthKeysInclusive(from, to).map((monthKey) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      budget: map.get(monthKey) ?? 0,
    }));
  }, [projects]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
            </CardHeader>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full rounded-md" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription>Projects completed</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {completedProjectCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription>Total incomes</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {formatAmount(totalPaid)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>
                {pieMode === 'status'
                  ? 'Projects by status'
                  : 'Projects by type'}
              </CardTitle>
              <CardDescription>
                {pieMode === 'status'
                  ? 'Distribution across project statuses'
                  : 'Distribution across project types'}
              </CardDescription>
            </div>
            <Select
              value={pieMode}
              onValueChange={(v) => setPieMode(v as PieMode)}>
              <SelectTrigger
                className="h-8 w-[160px] shrink-0"
                aria-label="Project distribution chart mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Project status</SelectItem>
                <SelectItem value="type">Project type</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="min-h-[300px] min-w-0 w-full">
            {pieMode === 'status' ? (
              projects.length === 0 ? (
                <p className="text-muted-foreground py-16 text-center text-sm">
                  No projects yet.
                </p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={280}
                  className="min-w-0 [&_.recharts-surface]:outline-none">
                  <BarChart
                    data={statusBarData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [String(value ?? ''), 'Projects']}
                    />
                    <Bar
                      dataKey="count"
                      name="Projects"
                      radius={[4, 4, 0, 0]}>
                      {statusBarData.map((entry, index) => (
                        <Cell
                          key={entry.key}
                          fill={CHART_CYCLE[index % CHART_CYCLE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : typePieData.length === 0 ? (
              <p className="text-muted-foreground py-16 text-center text-sm">
                No projects yet.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={280}
                className="min-w-0 [&_.recharts-surface]:outline-none">
                <PieChart>
                  <Pie
                    data={typePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((Number(percent) || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{
                      stroke: 'var(--muted-foreground)',
                      strokeOpacity: 0.35,
                    }}>
                    {typePieData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={CHART_CYCLE[index % CHART_CYCLE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [String(value ?? ''), 'Projects']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Clients</CardTitle>
            <CardDescription>Top {BAR_TOP_N} clients</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] min-w-0 w-full">
            {clientBarData.length === 0 ? (
              <p className="text-muted-foreground py-16 text-center text-sm">
                No projects yet.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={280}
                className="min-w-0 [&_.recharts-surface]:outline-none">
                <BarChart
                  data={clientBarData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                  <XAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-32}
                    textAnchor="end"
                    height={56}
                    interval={0}
                  />
                  <YAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => [String(value ?? ''), 'Projects']}
                  />
                  <Bar
                    dataKey="count"
                    name="Projects"
                    radius={[4, 4, 0, 0]}>
                    {clientBarData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CLIENT_BAR_CYCLE[index % CLIENT_BAR_CYCLE.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              {billingMode === 'type'
                ? 'Budget, invoiced, and paid totals by project type'
                : `Budget, invoiced, and paid by client (top ${BAR_TOP_N})`}
            </CardDescription>
          </div>
          <Select
            value={billingMode}
            onValueChange={(v) => setBillingMode(v as BillingMode)}>
            <SelectTrigger
              className="h-8 w-[160px] shrink-0"
              aria-label="Billing chart mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="type">Project type</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="min-h-[300px] min-w-0 w-full">
          {activeBillingData.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              No projects yet.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={320}
              className="min-w-0 [&_.recharts-surface]:outline-none">
              <BarChart
                data={activeBillingData}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-32}
                  textAnchor="end"
                  height={56}
                  interval={0}
                />
                <YAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatAmount(Number(v))}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatAmount(Number(value)),
                    String(name ?? ''),
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="budget"
                  name="Budget"
                  fill="var(--chart-2)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="invoiced"
                  name="Invoiced"
                  fill="var(--chart-3)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="paid"
                  name="Paid"
                  fill="var(--chart-5)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing forecast</CardTitle>
          <CardDescription>Sum of project budgets by month</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px] min-w-0 w-full">
          {billingForecastData.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              No projects yet.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={300}
              className="min-w-0 [&_.recharts-surface]:outline-none">
              <BarChart
                data={billingForecastData}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatAmount(Number(v))}
                />
                <Tooltip
                  formatter={(value) => [formatAmount(Number(value)), 'Budget']}
                />
                <Bar
                  dataKey="budget"
                  name="Budget"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
