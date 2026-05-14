import { Head, router, usePage } from '@inertiajs/react';
import { 
  User, Clock, FileText, Activity, Layers, 
  Trash2, Edit3, PlusCircle, ChevronRight, Info, UserCheck, Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/Enums/UserRole';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ActivityLogsIndex({ logs, currentFilter = 'all' }: any) {
  const page = usePage().props as { auth?: { user?: { role?: string } } };
  const isWorker = page.auth?.user?.role === UserRole.Worker.value;

  const getActionTheme = (action: string) => {
    const themes: Record<string, { color: string, icon: any, label: string }> = {
      create_project: { color: 'blue', icon: PlusCircle, label: 'Création Projet' },
      update_project: { color: 'amber', icon: Edit3, label: 'Modification Projet' },
      delete_project: { color: 'rose', icon: Trash2, label: 'Suppression Projet' },
      create_task: { color: 'emerald', icon: PlusCircle, label: 'Nouvelle Tâche' },
      update_task: { color: 'purple', icon: Edit3, label: 'MàJ Tâche' },
      take_attendance: { color: 'teal', icon: UserCheck, label: 'Pointage Présence' },
      default: { color: 'slate', icon: Activity, label: 'Action Système' }
    };

    return themes[action] || themes.default;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const colorVariants: any = {
    blue: "bg-blue-500/10 text-blue-600 border-blue-200",
    amber: "bg-amber-500/10 text-amber-600 border-amber-200",
    rose: "bg-rose-500/10 text-rose-600 border-rose-200",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    purple: "bg-purple-500/10 text-purple-600 border-purple-200",
    slate: "bg-slate-500/10 text-slate-600 border-slate-200",
    teal: "bg-teal-500/10 text-teal-600 border-teal-200",
  };

  const handleFilterChange = (value: string) => {
    router.get('/activity-logs', { action: value }, { preserveState: true, preserveScroll: true });
  };

  return (
    <>
      <Head title={isWorker ? 'Historique' : 'Paramètres - Historique'} />

      <div className={cn('relative space-y-6 pb-10', isWorker && 'mx-auto max-w-3xl')}>
        {!isWorker && (
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[500px] bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.05),transparent_40%)]" />
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
                <h1 className={cn('font-semibold tracking-tight text-slate-900 dark:text-slate-100', isWorker ? 'text-xl' : 'text-[42px] font-bold')}>
                    {isWorker ? 'Historique' : 'Paramètres'}
                </h1>
                <p className={cn('text-muted-foreground', isWorker ? 'text-sm' : 'text-lg text-slate-500')}>
                    {isWorker ? 'Journal des actions sur la plateforme.' : 'Transparence totale sur les modifications effectuées'}
                </p>
            </div>
            
            <div className="flex items-center gap-3">
                <div className={cn('flex items-center gap-2 border bg-background px-2 py-1 shadow-sm', isWorker ? 'rounded-md' : 'rounded-xl')}>
                    <Filter className="h-4 w-4 text-slate-400" />
                    <Select value={currentFilter} onValueChange={handleFilterChange}>
                        <SelectTrigger className="w-[200px] border-0 bg-transparent ring-offset-transparent focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Filtrer par action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les actions</SelectItem>
                            <SelectItem value="create_project">Création Projet</SelectItem>
                            <SelectItem value="update_project">Modification Projet</SelectItem>
                            <SelectItem value="delete_project">Suppression Projet</SelectItem>
                            <SelectItem value="create_task">Nouvelle Tâche</SelectItem>
                            <SelectItem value="update_task">MàJ Tâche</SelectItem>
                            <SelectItem value="take_attendance">Pointage Présence</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

        <div className={cn('grid grid-cols-1 gap-6', isWorker ? '' : 'gap-8 lg:grid-cols-12')}>
            {!isWorker && (
            <div className="lg:col-span-4 space-y-6">
                <Card className="border-0 bg-slate-900 text-white shadow-xl overflow-hidden relative">
                    <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-white/5 blur-2xl" />
                    <CardHeader>
                        <CardTitle className="text-white/60 text-xs font-bold uppercase tracking-widest">Aperçu</CardTitle>
                        <div className="text-4xl font-black">{logs.length}</div>
                        <p className="text-white/40 text-sm">Événements affichés</p>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs font-medium text-white/80">
                            <Info className="h-4 w-4 text-purple-400" />
                            Les logs sont conservés pendant 3 mois.
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold">Légende des actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {['create_project', 'update_project', 'delete_project', 'create_task', 'take_attendance'].map(act => {
                            const theme = getActionTheme(act);

                            return (
                                <div key={act} className="flex items-center gap-3">
                                    <div className={cn("h-2 w-2 rounded-full", `bg-${theme.color}-500`)} />
                                    <span className="text-sm font-semibold text-slate-600">{theme.label}</span>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
            )}

            {/* Main Timeline */}
            <div className={cn(isWorker ? 'lg:col-span-12' : 'lg:col-span-8')}>
                <Card
                    className={cn(
                        'overflow-hidden border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]',
                        isWorker && 'rounded-md border border-border shadow-sm',
                    )}
                >
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 px-4 py-3 sm:px-6 sm:py-4">
                        <CardTitle className={cn('flex items-center gap-2 font-semibold', isWorker ? 'text-sm' : 'text-xl font-bold')}>
                            <Activity className={cn('h-4 w-4 text-muted-foreground', !isWorker && 'h-5 w-5 text-purple-500')} />
                            {isWorker ? 'Événements' : "File d'événements"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {logs.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {logs.map((log: any) => {
                                    const theme = getActionTheme(log.action);
                                    const Icon = theme.icon;

                                    return (
                                        <div
                                            key={log.id}
                                            className={cn(
                                                'group relative transition-colors hover:bg-muted/30',
                                                isWorker ? 'p-4' : 'p-8 hover:bg-slate-50/50',
                                            )}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div
                                                    className={cn(
                                                        'flex shrink-0 items-center justify-center border bg-white shadow-sm',
                                                        isWorker ? 'h-9 w-9 rounded-md' : 'h-12 w-12 rounded-2xl transition-transform group-hover:scale-110',
                                                        colorVariants[theme.color],
                                                    )}
                                                >
                                                    <Icon className={cn(isWorker ? 'h-4 w-4' : 'h-6 w-6')} />
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-1.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={cn(
                                                                    'text-foreground',
                                                                    isWorker ? 'text-sm font-medium' : 'text-sm font-black text-slate-900',
                                                                )}
                                                            >
                                                                {theme.label}
                                                            </span>
                                                            <span className="hidden text-muted-foreground sm:inline">·</span>
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Clock className="h-3 w-3 shrink-0" />
                                                                {formatDate(log.created_at)}
                                                            </span>
                                                        </div>
                                                        {log.user && (
                                                            <div
                                                                className={cn(
                                                                    'flex items-center gap-1.5 bg-muted px-2 py-0.5 text-muted-foreground',
                                                                    isWorker ? 'rounded-md text-[11px] font-medium' : 'rounded-lg px-3 py-1 text-[11px] font-bold text-slate-600',
                                                                )}
                                                            >
                                                                <User className="h-3 w-3 shrink-0" />
                                                                {isWorker ? log.user.name : log.user.name.toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p className="text-sm leading-relaxed text-muted-foreground">{log.description}</p>

                                                    {log.properties && Object.keys(log.properties).length > 0 && (
                                                        <div className="mt-2">
                                                            <details className="group/details">
                                                                <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground">
                                                                    <div className="flex h-5 w-5 items-center justify-center rounded border border-border bg-background transition-transform group-open/details:rotate-90">
                                                                        <ChevronRight className="h-3 w-3" />
                                                                    </div>
                                                                    Détails
                                                                </summary>
                                                                <div
                                                                    className={cn(
                                                                        'mt-2 overflow-hidden bg-muted p-3',
                                                                        isWorker ? 'rounded-md' : 'rounded-2xl bg-slate-900 p-5 shadow-inner',
                                                                    )}
                                                                >
                                                                    <pre
                                                                        className={cn(
                                                                            'whitespace-pre-wrap text-[11px] font-mono leading-relaxed',
                                                                            isWorker
                                                                                ? 'text-foreground'
                                                                                : 'text-purple-200/80',
                                                                        )}
                                                                    >
                                                                        {JSON.stringify(log.properties, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </details>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
                                <div className={cn('mb-3 bg-muted p-4', isWorker ? 'rounded-md' : 'rounded-full bg-slate-50 p-6')}>
                                    <Layers className={cn('text-muted-foreground', isWorker ? 'h-8 w-8' : 'h-12 w-12 text-slate-200')} />
                                </div>
                                <h3 className="text-base font-semibold text-foreground">Aucune activité</h3>
                                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                                    Les événements apparaîtront ici dès qu&apos;une action sera enregistrée.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </>
  );
}
