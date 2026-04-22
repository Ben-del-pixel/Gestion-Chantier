import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
} from 'chart.js';
import {
    Users,
    TrendingUp,
    Clock,
    MapPin,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    Calendar,
    ClipboardCheck,
    ChevronRight,
    PlusCircle,
    HardHat,
    AlertCircle,
} from 'lucide-react';
import React from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { apiList, updateStatus } from '@/actions/App/Http/Controllers/AttendanceController';
import {
    assignWorkers,
    initializeForProject,
} from '@/actions/App/Http/Controllers/AttendanceInitializationController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    BarElement,
    Title
);

const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, string> = {
        en_cours: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/60',
        initialisation: 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
        termine: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60',
        planifie: 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/60',
    };

    const label = status.replaceAll('_', ' ');
    
    return (
        <Badge
            variant="outline"
            className={cn('h-6 px-2.5 py-0 text-[11px] font-semibold capitalize tracking-wide', variants[status] || variants.initialisation)}
        >
            {label}
        </Badge>
    );
};

const statAccents = {
    blue: {
        border: 'border-blue-100/70 dark:border-blue-900/40',
        glow: 'bg-blue-500/8',
        icon: 'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300',
        strip: 'bg-blue-500',
    },
    emerald: {
        border: 'border-emerald-100/70 dark:border-emerald-900/40',
        glow: 'bg-emerald-500/8',
        icon: 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
        strip: 'bg-emerald-500',
    },
    orange: {
        border: 'border-orange-100/70 dark:border-orange-900/40',
        glow: 'bg-orange-500/8',
        icon: 'border-orange-100 bg-orange-50 text-orange-600 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300',
        strip: 'bg-orange-500',
    },
    violet: {
        border: 'border-violet-100/70 dark:border-violet-900/40',
        glow: 'bg-violet-500/8',
        icon: 'border-violet-100 bg-violet-50 text-violet-600 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300',
        strip: 'bg-violet-500',
    },
} as const;

const StatCard = ({
    title,
    value,
    subValue,
    icon: Icon,
    trend,
    trendValue,
    accent = 'blue',
}: any) => {
    const tone = statAccents[accent as keyof typeof statAccents] || statAccents.blue;

    return (
        <Card className={cn('group relative overflow-hidden border bg-background/85 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.28)] backdrop-blur-xl', tone.border)}>
            <div className={cn('absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100', tone.glow)} />
            <div className={cn('absolute inset-x-0 top-0 h-1', tone.strip)} />
            <CardContent className="relative p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">{title}</p>
                        <h4 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</h4>
                    </div>
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border', tone.icon)}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    {(trendValue || subValue) && (
                        <div className="flex items-center gap-1.5 pt-1">
                            {trendValue && (
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-0.5 text-[11px] font-bold',
                                        trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                    )}
                                >
                                    {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {trendValue}
                                </span>
                            )}
                            <span className="text-[11px] font-medium text-muted-foreground">{subValue}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export const ManagerDashboard = ({ projects = [], stats = {}, recentActivities = [], materialDistribution = [] }: any) => {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(value);
    };

    const lineData = {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
        datasets: [{
            label: 'montant',
            data: [45000, 52000, 48000, 61000, 55000, 68000],
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#3b82f6',
            borderWidth: 2,
            tension: 0.36,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
        }]
    };

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-[30px] font-bold tracking-tight text-slate-900 dark:text-white">Tableau de bord</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Vue d'ensemble des activités en temps réel</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <div className="rounded-[18px] border border-white/60 bg-white p-6 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                            <ClipboardCheck className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-500">Stock</span>
                    </div>
                    <div className="mt-6 space-y-1">
                        <div className="text-2xl font-semibold tracking-tight text-slate-950">{stats.total_materials || 0}</div>
                        <div className="text-sm text-slate-500">Matériaux en stock</div>
                    </div>
                </div>

                <div className="rounded-[18px] border border-white/60 bg-white p-6 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                            <Users className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-500">Employés</span>
                    </div>
                    <div className="mt-6 space-y-1">
                        <div className="text-2xl font-semibold tracking-tight text-slate-950">{stats.total_workers || 0}</div>
                        <div className="text-sm text-slate-500">Ouvriers actifs</div>
                    </div>
                </div>

                <div className="rounded-[18px] border border-white/60 bg-white p-6 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold text-blue-500">Chantiers</span>
                    </div>
                    <div className="mt-6 space-y-1">
                        <div className="text-2xl font-semibold tracking-tight text-slate-950">{stats.active_projects || 0}</div>
                        <div className="text-sm text-slate-500">Projets en cours</div>
                    </div>
                </div>

                <div className="rounded-[18px] border border-white/60 bg-white p-6 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-500">Budget</span>
                    </div>
                    <div className="mt-6 space-y-1">
                        <div className="text-2xl font-semibold tracking-tight text-slate-950">{formatCurrency(stats.total_budget || 0)}</div>
                        <div className="text-sm text-slate-500">Coût total projets</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                        <Card className="overflow-hidden border-0 bg-white shadow-[0_14px_40px_-22px_rgba(15,23,42,0.30)] xl:col-span-8">
                    <CardHeader className="px-6 pb-0 pt-6">
                        <CardTitle className="text-[18px] font-bold tracking-tight text-slate-900">Évolution des coûts</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-6 pt-2">
                        <div className="h-[280px]">
                            <Line
                                data={lineData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: 'white',
                                            titleColor: '#0f172a',
                                            bodyColor: '#3b82f6',
                                            borderColor: '#e2e8f0',
                                            borderWidth: 1,
                                            padding: 12,
                                            displayColors: false,
                                        },
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            grid: { color: '#e5e7eb' },
                                            ticks: {
                                                color: '#94a3b8',
                                                font: { size: 10, family: 'Inter' },
                                            },
                                        },
                                        x: {
                                            grid: { color: '#e5e7eb' },
                                            ticks: {
                                                color: '#94a3b8',
                                                font: { size: 10, family: 'Inter' },
                                            },
                                        },
                                    },
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-0 bg-white shadow-[0_14px_40px_-22px_rgba(15,23,42,0.30)] xl:col-span-4">
                    <CardHeader className="px-6 pb-0 pt-6">
                        <CardTitle className="text-[18px] font-bold tracking-tight text-slate-900">Distribution matériaux</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center gap-4 px-6 pb-6 pt-4">
                        {materialDistribution.length > 0 ? (
                            <>
                                <div className="relative h-52 w-52">
                                    <Doughnut
                                        data={{
                                            labels: materialDistribution.map((m: any) => m.label),
                                            datasets: [{
                                                data: materialDistribution.map((m: any) => m.total),
                                                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899'],
                                                borderWidth: 0,
                                            }],
                                        }}
                                        options={{
                                            plugins: { legend: { display: false } },
                                            cutout: '62%',
                                        }}
                                    />
                                </div>
                                <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    {materialDistribution.map((m: any, idx: number) => {
                                        const colors = ['text-blue-500', 'text-emerald-500', 'text-orange-500', 'text-red-500', 'text-violet-500', 'text-indigo-500', 'text-pink-500'];
                                        const total = materialDistribution.reduce((sum: number, item: any) => sum + item.total, 0);
                                        const percentage = total > 0 ? Math.round((m.total / total) * 100) : 0;
                                        
                                        return (
                                            <div key={idx} className={cn("flex items-center justify-between gap-2", colors[idx % colors.length])}>
                                                <span className="truncate max-w-[80px]">{m.label}</span>
                                                <span>{percentage}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-52 text-slate-400 text-sm italic">
                                Aucune donnée de stock
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden border-0 bg-white shadow-[0_14px_40px_-22px_rgba(15,23,42,0.30)]">
                <CardHeader className="px-6 pb-0 pt-6">
                    <CardTitle className="text-[18px] font-bold tracking-tight text-slate-900">Activités récentes</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-4">
                    <div className="space-y-4">
                        {recentActivities.length > 0 ? recentActivities.map((activity: any) => (
                            <div key={activity.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{activity.description}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <span>{activity.user?.name}</span>
                                            <span>•</span>
                                            <span>{new Date(activity.created_at).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-6 text-slate-500 text-sm italic">Aucune activité récente</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export const EngineerDashboard = ({
    tasks,
    stats,
    attendanceProjects = [],
    attendanceWorkers = [],
    attendanceStatuses = [],
    attendanceShifts = [],
    attendanceDate,
}: any) => {
    const [selectedDate, setSelectedDate] = React.useState(attendanceDate || new Date().toISOString().slice(0, 10));
    const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
        attendanceProjects[0]?.id ? String(attendanceProjects[0].id) : ''
    );
    const [attendances, setAttendances] = React.useState<any[]>([]);
    const [isRefreshingAttendances, setIsRefreshingAttendances] = React.useState(false);
    const [isSavingAssignment, setIsSavingAssignment] = React.useState(false);
    const [isInitializing, setIsInitializing] = React.useState(false);
    const [selectedWorkers, setSelectedWorkers] = React.useState<number[]>([]);
    const [selectedShifts, setSelectedShifts] = React.useState<string[]>(['morning', 'evening']);
    const [showAssignDialog, setShowAssignDialog] = React.useState(false);
    const [showInitializeDialog, setShowInitializeDialog] = React.useState(false);

    const refreshAttendances = React.useCallback(async () => {
        if (!selectedProjectId || !selectedDate) {
            setAttendances([]);

            return;
        }

        setIsRefreshingAttendances(true);

        try {
            const response = await fetch(
                apiList.url({ query: { date: selectedDate, project_id: selectedProjectId } }),
                {
                    method: apiList().method,
                    headers: {
                        Accept: 'application/json',
                    },
                }
            );

            if (!response.ok) {
                alert('Erreur lors du chargement des presences');

                return;
            }

            const data = await response.json();
            setAttendances(data.attendances ?? []);
        } catch {
            alert('Erreur reseau pendant le chargement des presences');
        } finally {
            setIsRefreshingAttendances(false);
        }
    }, [selectedDate, selectedProjectId]);

    React.useEffect(() => {
        void refreshAttendances();
    }, [refreshAttendances]);

    const handleStatusChange = async (attendanceId: number, status: string) => {
        try {
            const response = await fetch(updateStatus.url(attendanceId), {
                method: updateStatus(attendanceId).method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Erreur lors de la mise a jour du statut');

                return;
            }

            const payload = await response.json();
            setAttendances((prev) =>
                prev.map((attendance) =>
                    attendance.id === attendanceId ? { ...attendance, ...payload.attendance } : attendance
                )
            );
        } catch {
            alert('Erreur reseau lors de la mise a jour du statut');
        }
    };

    const toggleWorker = (workerId: number) => {
        setSelectedWorkers((prev) =>
            prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
        );
    };

    const toggleShift = (shift: string) => {
        setSelectedShifts((prev) => (prev.includes(shift) ? prev.filter((item) => item !== shift) : [...prev, shift]));
    };

    const submitWorkersAssignment = async () => {
        if (!selectedProjectId) {
            alert('Selectionnez un projet');

            return;
        }

        if (selectedWorkers.length === 0) {
            alert('Selectionnez au moins un ouvrier');

            return;
        }

        setIsSavingAssignment(true);

        try {
            const response = await fetch(assignWorkers.url(Number(selectedProjectId)), {
                method: assignWorkers(Number(selectedProjectId)).method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ worker_ids: selectedWorkers }),
            });

            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Erreur lors de l\'affectation');

                return;
            }

            setShowAssignDialog(false);
            alert('Affectation des ouvriers effectuee');
        } catch {
            alert('Erreur reseau lors de l\'affectation des ouvriers');
        } finally {
            setIsSavingAssignment(false);
        }
    };

    const submitPresenceInitialization = async () => {
        if (!selectedProjectId) {
            alert('Selectionnez un projet');

            return;
        }

        if (selectedShifts.length === 0) {
            alert('Selectionnez au moins un shift');

            return;
        }

        setIsInitializing(true);

        try {
            const response = await fetch(initializeForProject.url(), {
                method: initializeForProject().method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    project_id: Number(selectedProjectId),
                    date: selectedDate,
                    shifts: selectedShifts,
                }),
            });

            const payload = await response.json();

            if (!response.ok) {
                alert(payload.error || payload.message || 'Erreur lors de l\'initialisation');

                return;
            }

            setShowInitializeDialog(false);
            alert(`${payload.created} presences initialisees`);
            await refreshAttendances();
        } catch {
            alert('Erreur reseau lors de l\'initialisation des presences');
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-end justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Espace Ingénierie</h1>
                    <p className="text-sm text-muted-foreground">Superviser l'ordonnancement et les ressources humaines.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm">
                                Assigner Ouvriers
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogTitle>Affectation des ouvriers</DialogTitle>
                            <div className="mt-4 space-y-4">
                                <p className="text-sm text-muted-foreground">Selectionnez les ouvriers a affecter au projet.</p>
                                <div className="grid grid-cols-1 gap-2 rounded-lg border p-3">
                                    {attendanceWorkers.length > 0 ? (
                                        attendanceWorkers.map((worker: any) => (
                                            <label key={worker.id} className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedWorkers.includes(worker.id)}
                                                    onChange={() => toggleWorker(worker.id)}
                                                />
                                                <span>{worker.name}</span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Aucun ouvrier disponible.</p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Annuler</Button>
                                    </DialogClose>
                                    <Button type="button" onClick={submitWorkersAssignment} disabled={isSavingAssignment}>
                                        {isSavingAssignment ? 'Affectation...' : 'Valider'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showInitializeDialog} onOpenChange={setShowInitializeDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm">
                                Initialiser Presence
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogTitle>Initialiser la presence du projet</DialogTitle>
                            <div className="mt-4 space-y-4">
                                <p className="text-sm text-muted-foreground">Cree des presences vides pour la date et les shifts choisis.</p>
                                <div className="space-y-2">
                                    <Label>Shifts</Label>
                                    <div className="flex flex-wrap gap-4">
                                        {attendanceShifts.map((shift: any) => (
                                            <label key={shift.value} className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShifts.includes(shift.value)}
                                                    onChange={() => toggleShift(shift.value)}
                                                />
                                                <span>{shift.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Annuler</Button>
                                    </DialogClose>
                                    <Button type="button" onClick={submitPresenceInitialization} disabled={isInitializing}>
                                        {isInitializing ? 'Initialisation...' : 'Initialiser'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm"><PlusCircle className="mr-2 h-4 w-4" />Nouvelle Tâche</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={ClipboardCheck} title="Missions Actives" value={stats?.active_tasks || 0} subValue="Processus en cours" />
                <StatCard icon={HardHat} title="Personnel Site" value={stats?.total_workers_under || 0} subValue="Ouvriers affectés" />
                <StatCard icon={Clock} title="Heures Chantier" value="142h" subValue="Semaine en cours" />
            </div>

            <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Gestion Presence Ouvriers</CardTitle>
                    <CardDescription className="text-xs">Pilotage de la presence quotidienne par projet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label>Date</Label>
                            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <Label>Projet</Label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                            >
                                <option value="">-- Selectionner un projet --</option>
                                {attendanceProjects.map((project: any) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button type="button" variant="outline" className="w-full" onClick={refreshAttendances} disabled={isRefreshingAttendances}>
                                {isRefreshingAttendances ? 'Actualisation...' : 'Actualiser'}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="px-4 py-2 font-semibold">Ouvrier</th>
                                    <th className="px-4 py-2 font-semibold">Shift</th>
                                    <th className="px-4 py-2 font-semibold">Heure Arrivee</th>
                                    <th className="px-4 py-2 font-semibold">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendances.length > 0 ? (
                                    attendances.map((attendance) => (
                                        <tr key={attendance.id} className="border-t">
                                            <td className="px-4 py-2 font-medium">{attendance.user?.name ?? '-'}</td>
                                            <td className="px-4 py-2">{attendance.shift}</td>
                                            <td className="px-4 py-2">
                                                {attendance.check_in
                                                    ? new Date(attendance.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                                    : '-'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {attendanceStatuses.map((status: any) => (
                                                        <button
                                                            key={status.value}
                                                            type="button"
                                                            onClick={() => handleStatusChange(attendance.id, status.value)}
                                                            className={`rounded-full px-2 py-1 text-xs border transition ${
                                                                attendance.status === status.value
                                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                                    : 'bg-background border-border hover:bg-muted'
                                                            }`}
                                                        >
                                                            {status.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                                            Aucune presence pour cette selection.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Planning Opérationnel</CardTitle>
                    <CardDescription className="text-xs">Suivi en temps réel des interventions par projet</CardDescription>
                </CardHeader>
                <div className="divide-y border-t border-border/50">
                    {tasks.length > 0 ? tasks.map((t: any) => (
                        <div key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-2xl border ${t.status === 'en_cours' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div className="space-y-1.5 pt-0.5">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-base font-bold text-foreground tracking-tight">{t.name}</h4>
                                        <Badge variant="secondary" className="px-2 py-0 h-5 text-[10px] font-bold uppercase">{t.project?.name}</Badge>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                            <Users size={12} className="text-slate-400" />
                                            <span>{t.workers?.length || 0} Personnel</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                            <Calendar size={12} className="text-slate-400" />
                                            <span>Fin {new Date(t.end_date).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <StatusBadge status={t.status} />
                                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8"><ChevronRight size={18} /></Button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-16 text-center text-muted-foreground text-sm font-medium">Aucune tâche assignée</div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export const WorkerDashboard = ({ tasks, workerAttendances = [], workerAttendanceSummary }: any) => {
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().slice(0, 10));

    const attendanceStatusLabels: Record<string, string> = {
        present: 'Present',
        absent: 'Absent',
        retard: 'Retard',
        malade: 'Malade',
    };

    const attendanceStatusClasses: Record<string, string> = {
        present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        absent: 'bg-rose-50 text-rose-700 border-rose-200',
        retard: 'bg-amber-50 text-amber-700 border-amber-200',
        malade: 'bg-blue-50 text-blue-700 border-blue-200',
    };

    const recordsForSelectedDate = workerAttendances.filter((attendance: any) => {
        const attendanceDate = String(attendance.date).slice(0, 10);

        return attendanceDate === selectedDate;
    });

    const recentAttendances = workerAttendances.slice(0, 12);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in zoom-in duration-500">
            <div className="bg-primary p-12 rounded-[2rem] text-primary-foreground shadow-xl shadow-primary/10 relative overflow-hidden group">
                <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-2 bg-white/10 w-fit px-4 py-1.5 rounded-full border border-white/20">
                        <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-50">Actuellement en service</span>
                    </div>

                    {tasks && tasks[0] ? (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-primary-foreground/60 uppercase tracking-[0.2em]">Affectation Principale</p>
                                <h1 className="text-4xl font-black uppercase tracking-tight leading-tight">{tasks[0].name}</h1>
                            </div>
                            <div className="flex flex-wrap items-center gap-8 pt-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase opacity-60">Emplacement SITE</p>
                                    <p className="text-lg font-bold flex items-center gap-2 underline underline-offset-4 decoration-white/20"><MapPin size={18} />{tasks[0].project?.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase opacity-60">Plage de Travail</p>
                                    <div className="flex items-center gap-2 text-lg font-bold"><Clock size={18} />08:00 — 17:00</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <h2 className="text-3xl font-bold italic">En attente de mission</h2>
                    )}
                </div>
                <MapPin className="absolute -right-16 -bottom-16 w-64 h-64 opacity-10 rotate-12" strokeWidth={1} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Button className="h-28 rounded-3xl text-2xl font-black uppercase tracking-tighter shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Pointer Début
                    <CheckCircle2 className="ml-4 h-8 w-8" />
                </Button>
                <Button variant="outline" className="h-28 rounded-3xl text-2xl font-black uppercase tracking-tighter border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-slate-400">
                    Déclarer Incident
                    <AlertCircle className="ml-4 h-8 w-8" strokeWidth={3} />
                </Button>
            </div>

            <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm rounded-[2rem] overflow-hidden">
                <CardHeader className="p-8 border-b border-border/50">
                    <CardTitle className="text-lg font-bold">Suivi Presence</CardTitle>
                    <CardDescription>Consulte ton statut du jour et les jours passes.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl border p-3">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Present</p>
                            <p className="text-2xl font-black">{workerAttendanceSummary?.present ?? 0}</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Absent</p>
                            <p className="text-2xl font-black">{workerAttendanceSummary?.absent ?? 0}</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Retard</p>
                            <p className="text-2xl font-black">{workerAttendanceSummary?.retard ?? 0}</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Malade</p>
                            <p className="text-2xl font-black">{workerAttendanceSummary?.malade ?? 0}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="attendance-date">Choisir une date</Label>
                        <Input
                            id="attendance-date"
                            type="date"
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            className="max-w-xs"
                        />
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="px-4 py-2 font-semibold">Date</th>
                                    <th className="px-4 py-2 font-semibold">Projet</th>
                                    <th className="px-4 py-2 font-semibold">Shift</th>
                                    <th className="px-4 py-2 font-semibold">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recordsForSelectedDate.length > 0 ? (
                                    recordsForSelectedDate.map((attendance: any) => (
                                        <tr key={attendance.id} className="border-t">
                                            <td className="px-4 py-2 font-medium">
                                                {new Date(attendance.date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-4 py-2">{attendance.project?.name ?? '-'}</td>
                                            <td className="px-4 py-2 capitalize">{attendance.shift ?? '-'}</td>
                                            <td className="px-4 py-2">
                                                <span
                                                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${attendanceStatusClasses[attendance.status] ?? 'bg-muted text-foreground border-border'}`}
                                                >
                                                    {attendanceStatusLabels[attendance.status] ?? attendance.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                            Aucun enregistrement pour cette date.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <p className="text-sm font-semibold mb-3">Historique recent</p>
                        <div className="space-y-2">
                            {recentAttendances.length > 0 ? (
                                recentAttendances.map((attendance: any) => (
                                    <div key={attendance.id} className="rounded-lg border px-3 py-2 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-sm">
                                                {new Date(attendance.date).toLocaleDateString('fr-FR')} - {attendance.project?.name ?? 'Sans projet'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Shift: {attendance.shift ?? '-'}</p>
                                        </div>
                                        <span
                                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${attendanceStatusClasses[attendance.status] ?? 'bg-muted text-foreground border-border'}`}
                                        >
                                            {attendanceStatusLabels[attendance.status] ?? attendance.status}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Aucune donnee de presence disponible.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm rounded-[2rem] overflow-hidden">
                <CardHeader className="p-8 border-b border-border/50">
                    <CardTitle className="text-lg font-bold">Feuille de Route Hebdomadaire</CardTitle>
                </CardHeader>
                <div className="divide-y divide-border/50">
                    {tasks.map((t: any, i: number) => (
                        <div key={t.id} className="p-8 flex items-center gap-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                            <div className="h-16 w-16 rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-white shrink-0 group-hover:bg-primary transition-colors">
                                <span className="text-[10px] font-bold uppercase opacity-40 leading-none mb-0.5">MARS</span>
                                <span className="text-2xl font-black tracking-tight leading-none">{15 + i}</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold tracking-tight uppercase">{t.name}</h4>
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mt-1 group-hover:text-primary transition-colors">
                                    <MapPin size={12} /> {t.project?.name}
                                </div>
                            </div>
                            <StatusBadge status={t.status} />
                        </div>
                    ))}
                    {tasks.length === 0 && <div className="p-16 text-center italic text-muted-foreground text-sm font-medium">Planning disponible prochainement</div>}
                </div>
            </Card>
        </div>
    );
};
