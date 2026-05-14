import { usePage } from '@inertiajs/react';
import { AlertCircle, Calendar, CheckCircle2, Clock, MapPin } from 'lucide-react';
import React from 'react';
import { StatusBadge } from '@/components/tasks/status-badge';
import { TaskExecuteButton } from '@/components/tasks/task-execute-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { attendanceStatusLabel } from '@/lib/attendance-labels';
import { cn } from '@/lib/utils';

const fieldClass =
    'h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const textareaClass =
    'min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function formatTaskEnd(t: any): string | null {
    if (!t?.end_date) {
        return null;
    }

    try {
        return new Date(t.end_date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return null;
    }
}

export function WorkerDashboard({
    tasks,
    workerAttendances = [],
    workerAttendanceSummary,
    workerIncidents = [],
}: {
    tasks?: any[];
    workerAttendances?: any[];
    workerAttendanceSummary?: { present?: number; absent?: number; retard?: number; malade?: number };
    workerIncidents?: any[];
}) {
    const page = usePage().props as any;
    const authenticatedUser = page?.auth?.user;
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [showIncidentDialog, setShowIncidentDialog] = React.useState(false);
    const [isSubmittingIncident, setIsSubmittingIncident] = React.useState(false);
    const [isSubmittingAttendance, setIsSubmittingAttendance] = React.useState(false);
    const [incidentForm, setIncidentForm] = React.useState({
        title: '',
        details: '',
        severity: 'moyen',
    });

    const taskList = tasks ?? [];
    const primaryTask = taskList[0];

    const attendanceStatusClasses: Record<string, string> = {
        present: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
        absent: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
        retard: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        malade: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
    };

    const recordsForSelectedDate = workerAttendances.filter((attendance: any) => {
        const attendanceDate = String(attendance.date).slice(0, 10);

        return attendanceDate === selectedDate;
    });

    const recentAttendances = workerAttendances.slice(0, 10);
    const currentProjectId = primaryTask?.project?.id ?? null;
    const activeAttendance = workerAttendances.find((attendance: any) => !attendance.check_out);

    const submitWorkerCheckIn = async () => {
        if (!authenticatedUser?.id) {
            alert('Utilisateur non authentifié.');

            return;
        }

        if (!currentProjectId) {
            alert('Aucun chantier assigné pour le pointage.');

            return;
        }

        setIsSubmittingAttendance(true);

        try {
            const response = await fetch('/attendance/check-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    user_id: authenticatedUser?.id,
                    project_id: currentProjectId,
                    status: 'present',
                }),
            });

            if (!response.ok) {
                alert("Erreur lors du pointage d'arrivée.");

                return;
            }

            window.location.reload();
        } catch {
            alert("Erreur réseau pendant le pointage d'arrivée.");
        } finally {
            setIsSubmittingAttendance(false);
        }
    };

    const submitWorkerCheckOut = async () => {
        if (!activeAttendance?.id) {
            alert('Aucun pointage actif trouvé pour enregistrer la sortie.');

            return;
        }

        setIsSubmittingAttendance(true);

        try {
            const response = await fetch(`/attendance/${activeAttendance.id}/check-out`, {
                method: 'PUT',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            if (!response.ok) {
                alert('Erreur lors du pointage de sortie.');

                return;
            }

            window.location.reload();
        } catch {
            alert('Erreur réseau pendant le pointage de sortie.');
        } finally {
            setIsSubmittingAttendance(false);
        }
    };

    const submitIncident = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingIncident(true);

        try {
            const response = await fetch('/incidents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    ...incidentForm,
                    project_id: primaryTask?.project?.id ?? null,
                }),
            });

            if (!response.ok) {
                let errorMessage = "Impossible de déclarer l'incident.";

                try {
                    const payload = await response.json();

                    if (payload?.errors) {
                        const firstFieldErrors = Object.values(payload.errors)[0] as string[] | undefined;
                        errorMessage = firstFieldErrors?.[0] ?? errorMessage;
                    } else if (payload?.message) {
                        errorMessage = payload.message;
                    }
                } catch {
                    //
                }

                alert(errorMessage);

                return;
            }

            setIncidentForm({ title: '', details: '', severity: 'moyen' });
            setShowIncidentDialog(false);
            window.location.reload();
        } catch {
            alert("Erreur réseau pendant la déclaration d'incident.");
        } finally {
            setIsSubmittingIncident(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-5 pb-8">
            <header className="space-y-1 border-b border-border pb-4">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Ma mission</h1>
                <p className="text-sm text-muted-foreground">Pointage, tâches et signalements sur le terrain.</p>
            </header>

            <section className="rounded-md border border-border bg-card p-4 sm:p-5">
                {primaryTask ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Tâche principale</p>
                            <h2 className="text-base font-semibold leading-snug text-foreground">{primaryTask.name}</h2>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                    {primaryTask.project?.name ?? 'Chantier'}
                                </span>
                                {formatTaskEnd(primaryTask) && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                        Échéance {formatTaskEnd(primaryTask)}
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                    Horaire habituel 08:00 — 17:00
                                </span>
                            </div>
                        </div>
                        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                            En service
                        </span>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Aucune mission assignée pour le moment.</p>
                )}
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                    type="button"
                    onClick={activeAttendance ? submitWorkerCheckOut : submitWorkerCheckIn}
                    disabled={isSubmittingAttendance}
                    className="h-10 rounded-md font-medium"
                >
                    {isSubmittingAttendance ? 'Traitement…' : activeAttendance ? 'Pointer la sortie' : "Pointer l'arrivée"}
                    <CheckCircle2 className="ml-2 size-4" aria-hidden />
                </Button>
                <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" className="h-10 rounded-md font-medium">
                            Déclarer un incident
                            <AlertCircle className="ml-2 size-4" aria-hidden />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-md border bg-card p-0 sm:max-w-md">
                        <div className="border-b border-border px-4 py-3">
                            <DialogTitle className="text-base font-semibold">Déclaration d&apos;incident</DialogTitle>
                        </div>
                        <form className="space-y-4 px-4 py-4" onSubmit={submitIncident}>
                            <div className="space-y-1.5">
                                <Label htmlFor="incident-title" className="text-xs font-medium text-muted-foreground">
                                    Titre
                                </Label>
                                <Input
                                    id="incident-title"
                                    value={incidentForm.title}
                                    onChange={(event) => setIncidentForm((prev) => ({ ...prev, title: event.target.value }))}
                                    placeholder="Ex. : chute de matériel"
                                    className={fieldClass}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="incident-severity" className="text-xs font-medium text-muted-foreground">
                                    Niveau
                                </Label>
                                <select
                                    id="incident-severity"
                                    value={incidentForm.severity}
                                    onChange={(event) => setIncidentForm((prev) => ({ ...prev, severity: event.target.value }))}
                                    className={fieldClass}
                                >
                                    <option value="faible">Faible</option>
                                    <option value="moyen">Moyen</option>
                                    <option value="eleve">Élevé</option>
                                    <option value="critique">Critique</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="incident-details" className="text-xs font-medium text-muted-foreground">
                                    Détails
                                </Label>
                                <textarea
                                    id="incident-details"
                                    value={incidentForm.details}
                                    onChange={(event) => setIncidentForm((prev) => ({ ...prev, details: event.target.value }))}
                                    className={textareaClass}
                                    rows={4}
                                    placeholder="Décrivez la situation…"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost" className="h-9 rounded-md">
                                        Annuler
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmittingIncident} className="h-9 rounded-md">
                                    {isSubmittingIncident ? 'Envoi…' : 'Envoyer'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="rounded-md border border-border shadow-none">
                <CardHeader className="space-y-0 border-b border-border px-4 py-3">
                    <CardTitle className="text-sm font-semibold">Incidents déclarés</CardTitle>
                    <CardDescription className="text-xs">Suivi côté chef de chantier / ingénieur.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 p-4">
                    {workerIncidents.length > 0 ? (
                        workerIncidents.map((incident: any) => {
                            const props = incident.properties ?? {};
                            const isResolved = props.status === 'resolved';

                            return (
                                <div
                                    key={incident.id}
                                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="text-sm font-medium text-foreground">{incident.description}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(incident.created_at).toLocaleDateString('fr-FR')} —{' '}
                                            {props.project_name ?? 'Chantier'} — {props.severity ?? 'moyen'}
                                        </p>
                                        {isResolved ? (
                                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                                Corrigé par {props.resolved_by_name ?? 'Chef de chantier'}
                                                {props.resolved_at
                                                    ? ` le ${new Date(props.resolved_at).toLocaleString('fr-FR')}`
                                                    : ''}
                                                {props.resolution_note ? ` — ${props.resolution_note}` : ''}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-amber-800 dark:text-amber-300">
                                                En traitement par le chef de chantier ou l&apos;ingénieur.
                                            </p>
                                        )}
                                    </div>
                                    <Badge
                                        variant={isResolved ? 'secondary' : 'outline'}
                                        className="shrink-0 rounded-md text-[10px] font-medium uppercase"
                                    >
                                        {isResolved ? 'Corrigé' : 'Ouvert'}
                                    </Badge>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-muted-foreground">Aucun incident déclaré.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="rounded-md border border-border shadow-none">
                <CardHeader className="space-y-0 border-b border-border px-4 py-3">
                    <CardTitle className="text-sm font-semibold">Présence</CardTitle>
                    <CardDescription className="text-xs">Statistiques et détail par date.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(
                            [
                                ['Présent', workerAttendanceSummary?.present ?? 0],
                                ['Absent', workerAttendanceSummary?.absent ?? 0],
                                ['Retard', workerAttendanceSummary?.retard ?? 0],
                                ['Malade', workerAttendanceSummary?.malade ?? 0],
                            ] as const
                        ).map(([label, value]) => (
                            <div key={label} className="rounded-md border border-border px-3 py-2.5">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="max-w-xs space-y-1.5">
                        <Label htmlFor="attendance-date" className="text-xs font-medium text-muted-foreground">
                            Date
                        </Label>
                        <Input
                            id="attendance-date"
                            type="date"
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            className={fieldClass}
                        />
                    </div>

                    <div className="overflow-hidden rounded-md border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/40">
                                <tr>
                                    <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                                    <th className="px-3 py-2 font-medium text-muted-foreground">Projet</th>
                                    <th className="px-3 py-2 font-medium text-muted-foreground">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recordsForSelectedDate.length > 0 ? (
                                    recordsForSelectedDate.map((attendance: any) => (
                                        <tr key={attendance.id} className="border-t border-border">
                                            <td className="px-3 py-2 font-medium">
                                                {new Date(attendance.date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">{attendance.project?.name ?? '—'}</td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={cn(
                                                        'inline-flex rounded-md border px-2 py-0.5 text-xs font-medium',
                                                        attendanceStatusClasses[attendance.status] ??
                                                            'border-border bg-muted text-foreground',
                                                    )}
                                                >
                                                    {attendanceStatusLabel(attendance.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                                            Aucun enregistrement pour cette date.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Historique récent</p>
                        <div className="space-y-1.5">
                            {recentAttendances.length > 0 ? (
                                recentAttendances.map((attendance: any) => (
                                    <div
                                        key={attendance.id}
                                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                                    >
                                        <span className="min-w-0 truncate text-foreground">
                                            {new Date(attendance.date).toLocaleDateString('fr-FR')} —{' '}
                                            {attendance.project?.name ?? 'Sans projet'}
                                        </span>
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium',
                                                attendanceStatusClasses[attendance.status] ??
                                                    'border-border bg-muted text-foreground',
                                            )}
                                        >
                                            {attendanceStatusLabel(attendance.status)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Aucune donnée de présence.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-md border border-border shadow-none">
                <CardHeader className="space-y-0 border-b border-border px-4 py-3">
                    <CardTitle className="text-sm font-semibold">Toutes les tâches assignées</CardTitle>
                    <CardDescription className="text-xs">Confirmez l&apos;exécution lorsque le travail est terminé.</CardDescription>
                </CardHeader>
                <div className="divide-y divide-border">
                    {taskList.length > 0 ? (
                        taskList.map((t: any) => (
                            <div key={t.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.project?.name}</p>
                                    {formatTaskEnd(t) && (
                                        <p className="text-xs text-muted-foreground">Échéance {formatTaskEnd(t)}</p>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    <TaskExecuteButton task={t} />
                                    <StatusBadge status={t.status} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune tâche assignée.</div>
                    )}
                </div>
            </Card>
        </div>
    );
}
