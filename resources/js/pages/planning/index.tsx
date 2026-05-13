import { Head, Link } from '@inertiajs/react';
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MapPin,
  User,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { index as projectsIndex, show as projectShow } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type WorkerRef = { id: number; name: string };

type PlanningTask = {
  id: number;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  workers: WorkerRef[];
};

type PlanningStep = {
  id: number;
  name: string;
  order: number;
  is_completed: boolean;
  tasks: PlanningTask[];
};

type PlanningProject = {
  id: number;
  name: string;
  status: string;
  start_date: string | null;
  deadline: string | null;
  engineer: { id: number; name: string } | null;
  chef_chantier: { id: number; name: string } | null;
  steps: PlanningStep[];
  tasks_without_step: PlanningTask[];
};

type FlatTask = PlanningTask & {
  project_id: number;
  project_name: string;
  step_name: string | null;
};

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

const STATUS_LABELS: Record<string, string> = {
  initialisation: 'Initialisation',
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  suspendu: 'Suspendu',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  retard: 'Retard',
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function taskWindow(task: PlanningTask): { start: string; end: string } | null {
  if (!task.start_date) {
    return null;
  }

  return {
    start: task.start_date,
    end: task.end_date ?? task.start_date,
  };
}

function overlapsDay(dayYmd: string, start: string, end: string): boolean {
  return dayYmd >= start && dayYmd <= end;
}

function projectHue(projectId: number): string {
  const hues = [210, 160, 280, 25, 340, 190, 45];

  return String(hues[projectId % hues.length]);
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function buildCalendarCells(viewYear: number, viewMonth: number): { ymd: string; inMonth: boolean; date: Date }[] {
  const first = new Date(viewYear, viewMonth, 1);
  const last = new Date(viewYear, viewMonth + 1, 0);
  const pad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const cells: { ymd: string; inMonth: boolean; date: Date }[] = [];

  for (let i = 0; i < pad; i++) {
    const d = new Date(viewYear, viewMonth, -pad + i + 1);
    cells.push({ date: d, inMonth: false, ymd: toYmd(d) });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    cells.push({ date: d, inMonth: true, ymd: toYmd(d) });
  }

  let next = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(viewYear, viewMonth + 1, next);
    cells.push({ date: d, inMonth: false, ymd: toYmd(d) });
    next += 1;
  }

  return cells;
}

function flattenTasks(projects: PlanningProject[]): FlatTask[] {
  const out: FlatTask[] = [];

  for (const p of projects) {
    for (const step of p.steps) {
      for (const t of step.tasks) {
        out.push({
          ...t,
          project_id: p.id,
          project_name: p.name,
          step_name: step.name,
        });
      }
    }

    for (const t of p.tasks_without_step) {
      out.push({
        ...t,
        project_id: p.id,
        project_name: p.name,
        step_name: null,
      });
    }
  }

  return out;
}

function TaskStatusBadge({ status }: { status: string }) {
  const label = TASK_STATUS_LABELS[status] ?? status;
  const cls =
    status === 'termine'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'en_cours'
        ? 'bg-blue-100 text-blue-800'
        : status === 'retard'
          ? 'bg-rose-100 text-rose-800'
          : 'bg-slate-100 text-slate-700';

  return (
    <Badge variant="secondary" className={cn('text-[10px] font-bold uppercase', cls)}>
      {label}
    </Badge>
  );
}

const MAX_CHIPS = 4;

export default function PlanningIndex({ projects }: { projects: PlanningProject[] }) {
  const todayYmd = toYmd(new Date());
  const [view, setView] = useState(() => {
    const n = new Date();

    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [dayDialog, setDayDialog] = useState<{ ymd: string; tasks: FlatTask[] } | null>(null);

  const allFlatTasks = useMemo(() => flattenTasks(projects), [projects]);

  const filteredTasks = useMemo(() => {
    if (!projectFilter) {
      return allFlatTasks;
    }

    const id = Number(projectFilter);

    return allFlatTasks.filter((t) => t.project_id === id);
  }, [allFlatTasks, projectFilter]);

  const cells = useMemo(
    () => buildCalendarCells(view.year, view.month),
    [view.year, view.month],
  );

  const monthTitle = new Date(view.year, view.month, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);

      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <>
      <Head title="Planning chantiers" />

      <div className="mx-auto max-w-screen-2xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
              <CalendarRange className="h-8 w-8 text-blue-600" />
              Planning
            </h1>
            <p className="mt-1 max-w-2xl text-slate-600">
              Calendrier des tâches par jour : chantier, étape, ouvriers, début et fin. Accès via le menu{' '}
              <strong>Planning</strong> (rôles directeur et ingénieur).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={projectsIndex.url()}
              className="text-sm font-bold text-blue-600 hover:text-blue-800"
            >
              Liste des chantiers →
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-slate-500">
              Aucun chantier à afficher pour votre périmètre.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg font-black capitalize text-slate-900">{monthTitle}</CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => shiftMonth(-1)}
                      aria-label="Mois précédent"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-3 font-bold text-slate-700"
                      onClick={() => {
                        const n = new Date();
                        setView({ year: n.getFullYear(), month: n.getMonth() });
                      }}
                    >
                      Aujourd&apos;hui
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => shiftMonth(1)}
                      aria-label="Mois suivant"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Filtrer par chantier</Label>
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="h-10 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm"
                    >
                      <option value="">Tous les chantiers</option>
                      {projects.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-7 gap-px border-b border-slate-200 bg-slate-200">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="bg-slate-100 px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500"
                    >
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-slate-200">
                  {cells.map((cell) => {
                    const dayTasks = filteredTasks.filter((t) => {
                      const w = taskWindow(t);

                      return w && overlapsDay(cell.ymd, w.start, w.end);
                    });
                    const visible = dayTasks.slice(0, MAX_CHIPS);
                    const extra = dayTasks.length - visible.length;
                    const isToday = cell.ymd === todayYmd;

                    return (
                      <div
                        key={cell.ymd}
                        className={cn(
                          'min-h-[112px] bg-white p-1.5 sm:min-h-[128px] sm:p-2',
                          !cell.inMonth && 'bg-slate-50/90',
                          isToday && 'ring-2 ring-blue-500 ring-inset',
                        )}
                      >
                        <div
                          className={cn(
                            'mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black',
                            cell.inMonth ? 'text-slate-800' : 'text-slate-400',
                            isToday && 'bg-blue-600 text-white',
                          )}
                        >
                          {cell.date.getDate()}
                        </div>
                        <div className="flex flex-col gap-1">
                          {visible.map((t) => {
                            const hue = projectHue(t.project_id);
                            const w = taskWindow(t);

                            return (
                              <button
                                key={`${t.id}-${cell.ymd}`}
                                type="button"
                                onClick={() => setDayDialog({ ymd: cell.ymd, tasks: [t] })}
                                className={cn(
                                  'w-full rounded-md border-l-[3px] bg-slate-50 px-1.5 py-1 text-left text-[10px] font-bold leading-tight text-slate-800 shadow-sm transition hover:bg-slate-100',
                                )}
                                style={{ borderLeftColor: `hsl(${hue} 70% 45%)` }}
                                title={`${t.project_name} — ${t.name}`}
                              >
                                <span className="line-clamp-2">{t.name}</span>
                                {w && (
                                  <span className="mt-0.5 block text-[9px] font-semibold text-slate-500">
                                    {w.start === w.end
                                      ? formatDate(w.start)
                                      : `${formatDate(w.start)} → ${formatDate(w.end)}`}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {extra > 0 && (
                            <button
                              type="button"
                              onClick={() => setDayDialog({ ymd: cell.ymd, tasks: dayTasks })}
                              className="rounded-md bg-blue-50 px-1.5 py-1 text-center text-[10px] font-black text-blue-700 hover:bg-blue-100"
                            >
                              +{extra} autre{extra > 1 ? 's' : ''}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-slate-500">
              Les carrés colorés indiquent une tâche à réaliser ce jour-là (du début à la fin prévue). Cliquez pour le
              détail.
            </p>

            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Détail par chantier</h2>
              {projects.map((project) => (
                <Collapsible key={project.id} defaultOpen={false} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <CollapsibleTrigger className="group flex flex-1 min-w-0 items-center gap-3 text-left">
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg font-black text-slate-900">{project.name}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange className="h-3 w-3" />
                            {formatDate(project.start_date)} → {formatDate(project.deadline)}
                          </span>
                          {project.engineer && (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Ing. {project.engineer.name}
                            </span>
                          )}
                          {project.chef_chantier && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Chef {project.chef_chantier.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className="font-bold uppercase tracking-tight">
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                      <Link
                        href={projectShow.url(project.id)}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        Fiche chantier
                      </Link>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-4 p-5 pt-2">
                      {project.tasks_without_step.length > 0 && (
                        <Card className="border-amber-200 bg-amber-50/40">
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm font-bold text-amber-900">Tâches sans étape liée</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <TaskTable tasks={project.tasks_without_step} />
                          </CardContent>
                        </Card>
                      )}

                      {project.steps.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucune étape définie sur ce chantier.</p>
                      ) : (
                        project.steps.map((step) => (
                          <Collapsible key={step.id} defaultOpen className="rounded-xl border border-slate-100 bg-slate-50/50">
                            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-left hover:bg-slate-100/80">
                              <div className="flex min-w-0 items-center gap-2">
                                <ListChecks className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span className="truncate font-bold text-slate-800">
                                  Étape {step.order} — {step.name}
                                </span>
                                {step.is_completed && <Badge className="bg-emerald-600 text-[10px]">Terminée</Badge>}
                              </div>
                              <span className="shrink-0 text-xs font-semibold text-slate-500">
                                {step.tasks.length} tâche{step.tasks.length !== 1 ? 's' : ''}
                              </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t border-slate-100 bg-white px-2 pb-3">
                              {step.tasks.length === 0 ? (
                                <p className="px-3 py-4 text-sm text-slate-500">Aucune tâche sur cette étape.</p>
                              ) : (
                                <TaskTable tasks={step.tasks} />
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={dayDialog !== null} onOpenChange={(o) => !o && setDayDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {dayDialog &&
                new Date(dayDialog.ymd + 'T12:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {dayDialog?.tasks.map((t) => {
              const w = taskWindow(t);

              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                  style={{ borderLeftWidth: 4, borderLeftColor: `hsl(${projectHue(t.project_id)} 70% 45%)` }}
                >
                  <p className="font-black text-slate-900">{t.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{t.project_name}</p>
                  {t.step_name && (
                    <p className="text-xs text-slate-600">
                      Étape : <span className="font-semibold">{t.step_name}</span>
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <TaskStatusBadge status={t.status} />
                    {w && (
                      <span className="text-xs font-semibold text-slate-600">
                        {formatDate(w.start)} — {formatDate(w.end)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Ouvriers</p>
                    {t.workers.length === 0 ? (
                      <p className="text-xs italic text-slate-400">Non affecté</p>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.workers.map((worker) => (
                          <Badge key={worker.id} variant="outline" className="text-[10px] font-semibold">
                            {worker.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link
                    href={projectShow.url(t.project_id)}
                    className="mt-3 inline-block text-xs font-bold text-blue-600 hover:underline"
                  >
                    Ouvrir le chantier →
                  </Link>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskTable({ tasks }: { tasks: PlanningTask[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Tâche</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Début</th>
            <th className="px-4 py-3">Fin</th>
            <th className="px-4 py-3">Ouvriers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-3 font-semibold text-slate-900">{task.name}</td>
              <td className="px-4 py-3">
                <TaskStatusBadge status={task.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(task.start_date)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(task.end_date)}</td>
              <td className="px-4 py-3">
                {task.workers.length === 0 ? (
                  <span className="text-xs italic text-slate-400">Non affecté</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {task.workers.map((w) => (
                      <Badge key={w.id} variant="outline" className="text-[10px] font-semibold">
                        {w.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
