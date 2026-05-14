import { Head, router, usePage } from '@inertiajs/react';
import { markExecuted } from '@/actions/App/Http/Controllers/Api/TaskController';
import { 
  Calendar, Clock, MapPin, User, Users, CheckCircle, XCircle, 
  Plus, Settings, Loader, Filter, Search, ArrowRight, UserCheck, 
  Clock3, AlertCircle, ChevronRight
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function AttendanceIndex({
  attendances: initialAttendances,
  date,
  statistics,
  projects,
  workers,
  statuses,
  selectedProject,
  assignedTasks = [],
}: any) {
  const page = usePage().props as any;
  const currentRole = page?.auth?.user?.role;
  const canManageAttendance = currentRole === 'manager' || currentRole === 'magasinier';
  const [displayDate, setDisplayDate] = useState(date);
  const [displayProject, setDisplayProject] = useState(
    selectedProject != null && selectedProject !== '' ? String(selectedProject) : ''
  );
  const [attendances, setAttendances] = useState(initialAttendances);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showAssignWorkers, setShowAssignWorkers] = useState(false);
  const [showInitialize, setShowInitialize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setAttendances(initialAttendances);
  }, [initialAttendances]);

  useEffect(() => {
    setDisplayDate(date);
    setDisplayProject(selectedProject != null && selectedProject !== '' ? String(selectedProject) : '');
  }, [date, selectedProject]);
  
  const defaultStatus = statuses?.length > 0 ? statuses[0].value : 'present';

  const [checkInData, setCheckInData] = useState({ user_id: '', project_id: '', status: defaultStatus });
  const [selectedProjectForAssign, setSelectedProjectForAssign] = useState('');
  const [selectedWorkersForAssign, setSelectedWorkersForAssign] = useState<number[]>([]);

  const refreshAttendances = async () => {
    setRefreshing(true);

    try {
      const params = new URLSearchParams();

      if (displayDate) {
params.append('date', displayDate);
}

      if (displayProject) {
params.append('project_id', displayProject);
}
      
      const response = await fetch(`/api/attendance/list?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        setAttendances(data.attendances);
      }
    } catch (error) {
      console.error('Error refreshing attendances:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFiltersChange = () => {
    router.get(
      '/attendance',
      {
        date: displayDate,
        ...(displayProject ? { project_id: displayProject } : {}),
      },
      { preserveScroll: true },
    );
  };

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    router.post('/attendance/check-in', checkInData, {
      onSuccess: () => {
        setShowCheckIn(false);
        setCheckInData({ user_id: '', project_id: '', status: defaultStatus });
      },
      onError: (err) => {
        alert('Erreur lors de l\'enregistrement');
      },
      onFinish: () => {
        setLoading(false);
      },
    });
  };

  const handleCheckOut = (attendanceId: number) => {
    if (!window.confirm('Confirmer le départ?')) {
      return;
    }

    router.put(`/attendance/${attendanceId}/check-out`, {}, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleStatusChange = (attendanceId: number, newStatus: string) => {
    router.put(`/attendance/${attendanceId}/status`, { status: newStatus }, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) {
return '-';
}

    try {
      return new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
 return '-'; 
}
  };

  return (
    <>
      <Head title="Gestion de la Présence" />

      <div className="relative space-y-8 pb-10">
        {currentRole !== 'worker' && (
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[500px] bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(16,185,129,0.05),transparent_35%)]" />
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {currentRole === 'worker' ? (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Ma présence</h1>
                <p className="mt-1 text-sm text-muted-foreground">Pointages et tâches sur vos chantiers.</p>
              </>
            ) : (
              <>
            <h1 className="text-[42px] font-bold tracking-tight text-slate-900">Présences & Pointage</h1>
            <p className="text-lg text-slate-500">Suivi en temps réel des effectifs sur les chantiers</p>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3">
            {canManageAttendance && (
              <>
            <Button 
                onClick={() => setShowAssignWorkers(true)} 
                variant="outline" 
                className="h-11 rounded-xl border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <Users className="mr-2 h-4 w-4 text-blue-500" />
              Assignations
            </Button>
            <Button 
                onClick={() => setShowInitialize(true)} 
                variant="outline" 
                className="h-11 rounded-xl border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <Calendar className="mr-2 h-4 w-4 text-emerald-500" />
              Initialiser Journée
            </Button>
            <Button 
                onClick={() => setShowCheckIn(true)} 
                className="h-11 rounded-xl bg-blue-600 px-6 font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:scale-[1.02]"
            >
              <Plus className="mr-2 h-5 w-5" />
              Nouveau Pointage
            </Button>
              </>
            )}
          </div>
        </div>

        {/* Statistics Widgets */}
        {currentRole !== 'worker' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PremiumStatCard 
            title="Effectif Total" 
            value={statistics.total_workers} 
            icon={Users} 
            color="blue"
            trend="Sur le projet actif"
          />
          <PremiumStatCard 
            title="Présents" 
            value={statistics.present} 
            icon={UserCheck} 
            color="emerald"
            trend="Actuellement sur site"
          />
          <PremiumStatCard 
            title="Retards / Sortis" 
            value={statistics.checked_out} 
            icon={Clock3} 
            color="amber"
            trend="Pointages complétés"
          />
          <PremiumStatCard 
            title="Absences" 
            value={statistics.absent} 
            icon={AlertCircle} 
            color="rose"
            trend="À justifier"
          />
        </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {currentRole === 'worker' && (
              <div className="lg:col-span-12">
                <Card className="rounded-md border border-border bg-card shadow-sm">
                  <CardHeader className="border-b border-border px-4 py-3">
                    <CardTitle className="text-sm font-semibold text-foreground">Mes tâches</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Tâches qui vous sont assignées sur les chantiers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    {assignedTasks.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {assignedTasks.map((task: any) => (
                          <div
                            key={task.id}
                            className={cn(
                              'rounded-md border px-3 py-3',
                              task.status === 'retard'
                                ? 'border-destructive/40 bg-destructive/5'
                                : 'border-border bg-muted/20',
                            )}
                          >
                            <p className="text-sm font-medium text-foreground">{task.name}</p>
                            <p className="text-xs text-muted-foreground">{task.project?.name ?? 'Projet non défini'}</p>
                            <p
                              className={cn(
                                'mt-2 text-xs font-medium capitalize text-muted-foreground',
                                task.status === 'retard' && 'text-destructive',
                              )}
                            >
                              Statut : {task.status?.replaceAll('_', ' ')}
                            </p>
                            {task.end_date && (
                              <p
                                className={cn(
                                  'mt-1 text-xs text-muted-foreground',
                                  task.status === 'retard' && 'text-destructive',
                                )}
                              >
                                Échéance : {new Date(task.end_date).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucune tâche assignée pour le moment.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Filters Sidebar */}
            <div className="lg:col-span-3">
                <Card
                    className={cn(
                        'sticky top-6 border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]',
                        currentRole === 'worker' && 'rounded-md border border-border shadow-sm',
                    )}
                >
                    <CardHeader className="pb-4">
                        <CardTitle
                            className={cn(
                                'flex items-center gap-2 font-semibold text-foreground',
                                currentRole === 'worker' ? 'text-sm' : 'text-lg font-bold',
                            )}
                        >
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            Filtres
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Date de pointage</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={displayDate}
                                    onChange={(e) => setDisplayDate(e.target.value)}
                                    className={cn(
                                        'w-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                                        currentRole === 'worker' ? 'rounded-md' : 'rounded-xl',
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Chantier</Label>
                            <select
                                value={displayProject}
                                onChange={(e) => setDisplayProject(e.target.value)}
                                className={cn(
                                    'w-full border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none',
                                    currentRole === 'worker' ? 'rounded-md' : 'rounded-xl',
                                )}
                            >
                                <option value="">Tous les chantiers</option>
                                {projects.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <Button
                            onClick={handleFiltersChange}
                            className={cn(
                                'w-full h-10 bg-slate-900 font-medium transition-all hover:bg-slate-800',
                                currentRole === 'worker' ? 'rounded-md' : 'h-11 rounded-xl font-bold',
                            )}
                        >
                            Appliquer
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Attendance Main List */}
            <div className="lg:col-span-9">
                <Card
                    className={cn(
                        'border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] overflow-hidden',
                        currentRole === 'worker' && 'rounded-md border border-border shadow-sm',
                    )}
                >
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-6 pt-6 px-8">
                        <div>
                            <CardTitle className={cn(currentRole === 'worker' ? 'text-base font-semibold' : 'text-xl font-bold')}>
                                {currentRole === 'worker' ? 'Mon pointage' : 'Rapport de présence'}
                            </CardTitle>
                            <CardDescription>
                                {attendances.length} personne{attendances.length > 1 ? 's' : ''} répertoriée{attendances.length > 1 ? 's' : ''}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            {refreshing && <Loader className="h-5 w-5 animate-spin text-blue-500" />}
                            <div className="hidden sm:block">
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aujourd'hui</p>
                                    <p className="text-sm font-bold text-slate-900">{new Date(displayDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="block w-full overflow-x-auto">
                            <table className="w-full border-collapse items-center bg-transparent">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="whitespace-nowrap px-8 py-4 text-left text-xs font-bold uppercase text-slate-400 tracking-wider">Ouvrier / Employé</th>
                                        <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-bold uppercase text-slate-400 tracking-wider">Pointage</th>
                                        <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-bold uppercase text-slate-400 tracking-wider">Statut</th>
                                        <th className="whitespace-nowrap px-8 py-4 text-right text-xs font-bold uppercase text-slate-400 tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {attendances.length > 0 ? attendances.map((attendance: any) => (
                                        <tr key={attendance.id} className="group transition-colors hover:bg-slate-50/50">
                                            <td className="whitespace-nowrap px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                        {attendance.user?.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{attendance.user?.name}</p>
                                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {attendance.project?.name}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        {formatTime(attendance.check_in)}
                                                    </div>
                                                    {attendance.check_out && (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                                            {formatTime(attendance.check_out)}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-5">
                                                <div className="flex items-center gap-1.5">
                                                    {statuses?.map((st: any) => (
                                                        <button
                                                            key={st.value}
                                                            onClick={() => canManageAttendance && handleStatusChange(attendance.id, st.value)}
                                                            disabled={!canManageAttendance}
                                                            className={cn(
                                                                "h-2.5 w-2.5 rounded-full transition-all duration-300",
                                                                attendance.status === st.value 
                                                                    ? (st.value === 'present' ? 'bg-emerald-500 ring-4 ring-emerald-500/20 scale-125' : 
                                                                       st.value === 'absent' ? 'bg-rose-500 ring-4 ring-rose-500/20 scale-125' : 
                                                                       'bg-amber-500 ring-4 ring-amber-500/20 scale-125')
                                                                    : "bg-slate-200 hover:bg-slate-300"
                                                            )}
                                                            title={st.label}
                                                        />
                                                    ))}
                                                    <span className="ml-2 text-xs font-bold text-slate-600 capitalize">
                                                        {statuses?.find((s: any) => s.value === attendance.status)?.label || attendance.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-8 py-5 text-right">
                                                {canManageAttendance && !attendance.check_out ? (
                                                    <Button
                                                        onClick={() => handleCheckOut(attendance.id)}
                                                        size="sm"
                                                        className="h-8 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 font-bold text-xs"
                                                    >
                                                        Fin de service
                                                    </Button>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                                                        <CheckCircle className="h-3 w-3" />
                                                        {attendance.check_out ? 'Complété' : 'Lecture seule'}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="py-20 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <div className="rounded-full bg-slate-50 p-4">
                                                        <Calendar className="h-10 w-10 text-slate-200" />
                                                    </div>
                                                    <p className="text-lg font-bold text-slate-400">Aucun pointage trouvé pour cette date</p>
                                                    {canManageAttendance && <Button onClick={() => setShowCheckIn(true)} variant="link" className="text-blue-600 font-bold">
                                                        Effectuer le premier pointage
                                                    </Button>}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* MODALS SECTION */}
        <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
            <DialogContent className="max-w-md rounded-3xl border-0 p-0 overflow-hidden">
                <div className="bg-blue-600 p-8 text-white">
                    <DialogTitle className="text-2xl font-bold">Nouveau Pointage</DialogTitle>
                    <DialogDescription className="text-blue-100 opacity-90">Enregistrer l'arrivée d'un collaborateur</DialogDescription>
                </div>
                <div className="p-8">
                    <form onSubmit={handleCheckIn} className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-400">Personnel</Label>
                            <select
                                value={checkInData.user_id}
                                onChange={(e) => setCheckInData({ ...checkInData, user_id: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
                                required
                            >
                                <option value="">Choisir un ouvrier...</option>
                                {workers?.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-400">Chantier</Label>
                            <select
                                value={checkInData.project_id}
                                onChange={(e) => setCheckInData({ ...checkInData, project_id: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
                                required
                            >
                                <option value="">Choisir un projet...</option>
                                {projects.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-400">Statut initial</Label>
                            <select
                                value={checkInData.status}
                                onChange={(e) => setCheckInData({ ...checkInData, status: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
                            >
                                {statuses?.map((s: any) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-blue-600 font-bold">
                                {loading ? 'Traitement...' : 'Confirmer pointage'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setShowCheckIn(false)} className="flex-1 h-12 rounded-xl">
                                Annuler
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

function PremiumStatCard({ title, value, icon: Icon, color, trend }: any) {
    const colorVariants: any = {
        blue: "bg-blue-500/10 text-blue-600",
        emerald: "bg-emerald-500/10 text-emerald-600",
        amber: "bg-amber-500/10 text-amber-600",
        rose: "bg-rose-500/10 text-rose-600",
    };

    return (
        <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] overflow-hidden transition-all hover:shadow-[0_15px_35px_-12px_rgba(0,0,0,0.15)] group">
            <CardContent className="p-7">
                <div className="flex items-center justify-between">
                    <div className={cn("rounded-2xl p-4 transition-transform group-hover:scale-110 duration-500", colorVariants[color])}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-right">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                        <h3 className="text-3xl font-black text-slate-900">{value}</h3>
                    </div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest italic opacity-80">
                    <div className={cn("h-1.5 w-1.5 rounded-full", color === 'blue' ? 'bg-blue-400' : color === 'emerald' ? 'bg-emerald-400' : color === 'amber' ? 'bg-amber-400' : 'bg-rose-400')} />
                    {trend}
                </div>
            </CardContent>
        </Card>
    );
}
