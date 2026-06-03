import { Head, router, usePage } from '@inertiajs/react';
import { Calendar, Download, FileText, Filter, Send, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { generate, submit } from '@/actions/App/Http/Controllers/ReportController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRole } from '@/Enums/UserRole';
import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

export default function ReportsIndex({
    reportTypes,
    projects: initialProjects,
    canSubmitReport,
    submitTargetLabel,
    receivedReports,
    sentReports,
    potentialRecipients,
}: any) {
    const page = usePage().props as {
        auth?: { user?: { role?: string } };
        errors?: Record<string, string>;
    };
    const formErrors = page.errors ?? {};
    const isWorker = page.auth?.user?.role === UserRole.Worker.value;
    const isManager = page.auth?.user?.role === UserRole.Manager.value;
    const showBudget = page.canViewBudget ?? true;
    const analyticsReportTypes = useMemo(
        () =>
            isManager
                ? reportTypes
                : (reportTypes as Array<{ value: string; label: string }>).filter(
                      (t) => t.value === 'project' || t.value === 'worker',
                  ),
        [reportTypes, isManager],
    );

    const { currency, setCurrency, formatCurrency } = useCurrency();
    const formControlClass = cn(
        'w-full border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40',
        isWorker ? 'h-10 rounded-md' : 'h-11 rounded-xl',
    );
    const formTextareaClass = cn(
        'w-full border border-border/60 bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40',
        isWorker ? 'min-h-[120px] rounded-md' : 'min-h-[140px] rounded-xl',
    );

    const [selectedReport, setSelectedReport] = useState(isManager ? 'global' : 'project');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [projectId, setProjectId] = useState('');
    const [workerId, setWorkerId] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [projects] = useState<any[]>(initialProjects || []);
    const [workers, setWorkers] = useState<any[]>([]);
    const [submissionForm, setSubmissionForm] = useState({
        title: '',
        content: '',
        project_id: '',
        recipient_id: '',
    });

    React.useEffect(() => {
        void fetchWorkers();
    }, []);

    const fetchWorkers = async () => {
        try {
            const workersRes = await fetch('/api/workers');

            if (workersRes.ok) {
                const data = await workersRes.json();
                setWorkers(data.workers || []);
            }
        } catch (error) {
            console.error('Error loading workers:', error);
        }
    };

    const handleGenerateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(generate.url(), {
                method: generate().method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    type: selectedReport,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    project_id: projectId || null,
                    worker_id: workerId || null,
                }),
            });

            if (!response.ok) {
                let message = 'Erreur lors de la generation du rapport';

                try {
                    const payload = await response.json();

                    if (payload?.message) {
                        message = payload.message;
                    }
                } catch {
                    //
                }

                throw new Error(message);
            }

            const data = await response.json();
            setReportData(data);
        } catch (error) {
            console.error('Error:', error);
            alert(error instanceof Error ? error.message : 'Erreur lors de la generation du rapport');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitReport = (e: React.FormEvent) => {
        e.preventDefault();

        if (!submissionForm.title.trim() || !submissionForm.content.trim()) {
            alert('Le titre et le contenu sont obligatoires.');

            return;
        }

        if (submissionForm.content.trim().length < 20) {
            alert('Le contenu doit contenir au moins 20 caracteres.');

            return;
        }

        setSubmitLoading(true);

        const payload: Record<string, string | null> = {
            title: submissionForm.title.trim(),
            content: submissionForm.content.trim(),
            project_id: submissionForm.project_id || null,
        };

        if (isManager && submissionForm.recipient_id) {
            payload.recipient_id = submissionForm.recipient_id;
        }

        router.post(submit.url(), payload, {
            onSuccess: () => {
                setSubmissionForm({ title: '', content: '', project_id: '', recipient_id: '' });
            },
            onError: (errors) => {
                const firstError =
                    errors.content ||
                    errors.title ||
                    errors.recipient_id ||
                    errors.recipient ||
                    errors.project_id;

                alert(firstError || 'Erreur lors de la soumission du rapport');
            },
            onFinish: () => {
                setSubmitLoading(false);
            },
        });
    };

    const handleDownloadReport = () => {
        if (!reportData) {
            return;
        }

        const content = generateReportContent();
        const bom = '\uFEFF'; // Excel-friendly UTF-8 BOM
        const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const element = document.createElement('a');
        element.href = url;
        element.download = `rapport_${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`;
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
    };

    const csvSeparator = ';';

    const csvCell = (value: unknown): string => {
        const raw = value === null || value === undefined ? '' : String(value);
        const normalized = raw.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
        const escaped = normalized.replaceAll('"', '""');

        return `"${escaped}"`;
    };

    const csvRow = (cells: unknown[]): string => cells.map(csvCell).join(csvSeparator) + '\n';

    const generateReportContent = (): string => {
        let content = '';
        // Hint Excel to use semicolon separator and avoid column disorder on open.
        content += `sep=${csvSeparator}\n`;
        content += csvRow([`Rapport ${reportData.type}`]);
        content += csvRow(['Généré le', new Date().toLocaleString('fr-FR')]);
        content += csvRow([
            'Période',
            `${reportData.period.start_date || 'Début'} à ${reportData.period.end_date || 'Fin'}`,
        ]);
        content += '\n';

        if (reportData.type === 'global') {
            content += generateGlobalContent();
        } else if (reportData.type === 'project') {
            content += generateProjectContent();
        } else if (reportData.type === 'worker') {
            content += generateWorkerContent();
        } else if (reportData.type === 'activities') {
            content += generateActivitiesContent();
        }

        return content;
    };

    const generateGlobalContent = (): string => {
        const d = reportData.data;
        let content = '';
        content += csvRow(['Résumé global']);
        content += csvRow(['Projets totaux', d.summary.total_projects]);
        content += csvRow(['Projets actifs', d.summary.active_projects]);
        content += csvRow(['Projets complétés', d.summary.completed_projects]);
        content += csvRow(['Tâches totales', d.summary.total_tasks]);
        content += csvRow(['Tâches complétées', d.summary.completed_tasks]);
        if (showBudget) {
            content += csvRow([`Budget total (${currency})`, d.summary.total_budget]);
        }
        content += csvRow(['Ouvriers', d.summary.total_workers]);
        content += csvRow(['Heures travaillées', d.summary.total_working_hours]);
        content += '\n';

        content += csvRow(['Projets par statut']);
        Object.entries(d.projects_by_status).forEach(([status, count]: any) => {
            content += csvRow([status, count]);
        });

        return content;
    };

    const generateProjectContent = (): string => {
        const selectedProjects = reportData.data;
        let content = '';
        content += csvRow(
            showBudget
                ? ['Nom', 'Statut', 'Début', 'Fin', `Budget (${currency})`, 'Manager', 'Ingénieur', 'Tâches', 'Ouvriers', 'Étapes']
                : ['Nom', 'Statut', 'Début', 'Fin', 'Manager', 'Ingénieur', 'Tâches', 'Ouvriers', 'Étapes'],
        );
        selectedProjects.forEach((p: any) => {
            content += csvRow(
                showBudget
                    ? [
                          p.name,
                          p.status,
                          p.start_date,
                          p.deadline,
                          p.budget,
                          p.manager || '-',
                          p.engineer || '-',
                          `${p.completed_tasks}/${p.total_tasks}`,
                          p.total_workers,
                          p.total_steps,
                      ]
                    : [
                          p.name,
                          p.status,
                          p.start_date,
                          p.deadline,
                          p.manager || '-',
                          p.engineer || '-',
                          `${p.completed_tasks}/${p.total_tasks}`,
                          p.total_workers,
                          p.total_steps,
                      ],
            );
        });

        return content;
    };

    const generateWorkerContent = (): string => {
        const selectedWorkers = reportData.data;
        let content = '';
        content += csvRow(['Nom', 'Email', 'Rôle', 'Tâches', 'Projets', 'Jours présents', 'Heures totales', 'Moyenne/jour']);
        selectedWorkers.forEach((w: any) => {
            content += csvRow([
                w.name,
                w.email,
                w.role,
                `${w.completed_tasks}/${w.total_tasks}`,
                w.projects_worked_on,
                w.attendance_days,
                w.total_working_hours,
                w.avg_hours_per_day,
            ]);
        });

        return content;
    };

    const generateActivitiesContent = (): string => {
        const d = reportData.data;
        let content = '';
        content += csvRow(['Activités totales', d.total_activities]);
        content += '\n';
        content += csvRow(['Par action']);
        Object.entries(d.action_statistics).forEach(([action, count]: any) => {
            content += csvRow([action, count]);
        });
        content += '\n';
        content += csvRow(['Par utilisateur']);
        d.user_statistics.forEach((s: any) => {
            content += csvRow([s.user_name || 'Inconnu', s.count]);
        });

        return content;
    };

    return (
        <>
            <Head title="Rapports" />

            <div className="w-full space-y-6">
                <div>
                    <h1 className={cn('font-semibold tracking-tight', isWorker ? 'text-xl' : 'text-3xl font-bold')}>
                        Rapports
                    </h1>
                    <p className={cn('text-muted-foreground', isWorker ? 'text-sm' : 'text-sm')}>
                        {isWorker
                            ? 'Consulter, générer ou transmettre un compte rendu.'
                            : 'Generez, redigez et soumettez les rapports.'}
                    </p>
                </div>

                <div className="flex justify-end">
                    <select
                        value={currency}
                        onChange={(event) => setCurrency(event.target.value as 'USD' | 'CDF')}
                        className={cn(
                            'border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700',
                            isWorker ? 'h-10 rounded-md' : 'h-11 rounded-xl font-semibold',
                        )}
                    >
                        <option value="USD">USD ($)</option>
                        <option value="CDF">FC (CDF)</option>
                    </select>
                </div>

                {canSubmitReport && (
                    <Card className={cn('shadow-none border-border/50 bg-card/60 backdrop-blur-sm', isWorker && 'rounded-md border')}>
                        <CardHeader>
                            <CardTitle className={cn('flex items-center gap-2', isWorker ? 'text-sm font-semibold' : '')}>
                                <FileText className="h-5 w-5" />
                                Rediger et soumettre un rapport
                            </CardTitle>
                            <CardDescription>
                                Ce rapport sera soumis a: {submitTargetLabel}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmitReport} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titre</Label>
                                        <Input
                                            value={submissionForm.title}
                                            onChange={(event) => setSubmissionForm((prev) => ({ ...prev, title: event.target.value }))}
                                            className={formControlClass}
                                            placeholder="Ex: Rapport journalier du chantier"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenu</Label>
                                        <textarea
                                            value={submissionForm.content}
                                            onChange={(event) => setSubmissionForm((prev) => ({ ...prev, content: event.target.value }))}
                                            className={formTextareaClass}
                                            rows={6}
                                            placeholder="Detaillez les points importants du jour..."
                                            minLength={20}
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Minimum 20 caracteres ({submissionForm.content.trim().length}/20)
                                        </p>
                                        {formErrors.content && (
                                            <p className="text-xs text-rose-600">{formErrors.content}</p>
                                        )}
                                        {formErrors.recipient && (
                                            <p className="text-xs text-rose-600">{formErrors.recipient}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projet (optionnel)</Label>
                                        <select
                                            value={submissionForm.project_id}
                                            onChange={(event) => setSubmissionForm((prev) => ({ ...prev, project_id: event.target.value }))}
                                            className={formControlClass}
                                        >
                                            <option value="">-- Aucun projet --</option>
                                            {projects.map((project: any) => (
                                                <option key={project.id} value={project.id}>{project.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {isManager && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destinataire</Label>
                                            <select
                                                value={submissionForm.recipient_id}
                                                onChange={(event) => setSubmissionForm((prev) => ({ ...prev, recipient_id: event.target.value }))}
                                                className={formControlClass}
                                                required
                                            >
                                                <option value="">-- Choisir un destinataire --</option>
                                                {(potentialRecipients || []).map((recipient: any) => (
                                                    <option key={recipient.id} value={recipient.id}>
                                                        {recipient.name} ({recipient.role})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={submitLoading} className={cn('gap-2', isWorker ? 'h-9 rounded-md' : 'rounded-lg')}>
                                        <Send className="h-4 w-4" />
                                        {submitLoading ? 'Soumission...' : 'Soumettre'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card className={cn('shadow-none border-border/50 bg-card/60 backdrop-blur-sm', isWorker && 'rounded-md border')}>
                        <CardHeader>
                            <CardTitle>Rapports recus</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                            {(receivedReports || []).length > 0 ? (
                                receivedReports.map((report: any) => (
                                    <div
                                        key={report.id}
                                        className={cn('border border-border/60 p-3', isWorker ? 'rounded-md' : 'rounded-lg')}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-semibold text-sm">{report.title}</p>
                                            <Badge variant="outline">{report.status}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">De: {report.sender?.name} ({report.sender?.role})</p>
                                        {report.project && (
                                            <p className="text-xs text-muted-foreground">Projet: {report.project.name}</p>
                                        )}
                                        <p className="text-sm mt-2 line-clamp-3">{report.content}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Aucun rapport recu.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className={cn('shadow-none border-border/50 bg-card/60 backdrop-blur-sm', isWorker && 'rounded-md border')}>
                        <CardHeader>
                            <CardTitle>Rapports envoyes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                            {(sentReports || []).length > 0 ? (
                                sentReports.map((report: any) => (
                                    <div
                                        key={report.id}
                                        className={cn('border border-border/60 p-3', isWorker ? 'rounded-md' : 'rounded-lg')}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-semibold text-sm">{report.title}</p>
                                            <Badge variant="outline">{report.status}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Vers: {report.recipient?.name} ({report.recipient?.role})</p>
                                        {report.project && (
                                            <p className="text-xs text-muted-foreground">Projet: {report.project.name}</p>
                                        )}
                                        <p className="text-sm mt-2 line-clamp-3">{report.content}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Aucun rapport envoye.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {isManager && (
                    <Card className={cn('shadow-none border-border/50 bg-card/60 backdrop-blur-sm', isWorker && 'rounded-md border')}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Filter className="h-5 w-5" />
                                Parametres du rapport analytique
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleGenerateReport} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type de rapport</Label>
                                        <select
                                            value={selectedReport}
                                            onChange={(event) => setSelectedReport(event.target.value)}
                                            className={formControlClass}
                                        >
                                            {analyticsReportTypes.map((type: any) => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedReport === 'project' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projet</Label>
                                            <select
                                                value={projectId}
                                                onChange={(event) => setProjectId(event.target.value)}
                                                className={formControlClass}
                                            >
                                                <option value="">{isManager ? '-- Tous les projets --' : '-- Sélectionner un projet --'}</option>
                                                {projects.map((project: any) => (
                                                    <option key={project.id} value={project.id}>{project.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Date debut
                                        </Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(event) => setStartDate(event.target.value)}
                                            className={formControlClass}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Date fin
                                        </Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(event) => setEndDate(event.target.value)}
                                            className={formControlClass}
                                        />
                                    </div>

                                    {selectedReport === 'worker' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ouvrier</Label>
                                            <select
                                                value={workerId}
                                                onChange={(event) => setWorkerId(event.target.value)}
                                                className={formControlClass}
                                            >
                                                <option value="">-- Tous --</option>
                                                {workers.map((worker: any) => (
                                                    <option key={worker.id} value={worker.id}>{worker.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={loading} className="rounded-lg">
                                        {loading ? 'Generation...' : 'Generer le rapport'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {isManager && reportData && (
                    <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    {reportTypes.find((reportType: any) => reportType.value === selectedReport)?.label}
                                </CardTitle>
                                <CardDescription className="mt-2">
                                    Periode: {reportData.period.start_date || 'Depuis le debut'} a {reportData.period.end_date || 'Aujourd\'hui'}
                                </CardDescription>
                            </div>
                            <Button onClick={handleDownloadReport} variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Telecharger CSV
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {selectedReport === 'global' && <GlobalReport data={reportData.data} formatCurrency={formatCurrency} />}
                            {selectedReport === 'project' && <ProjectReport data={reportData.data} formatCurrency={formatCurrency} showBudget={showBudget} />}
                            {selectedReport === 'worker' && <WorkerReport data={reportData.data} />}
                            {selectedReport === 'activities' && <ActivitiesReport data={reportData.data} />}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

function GlobalReport({ data, formatCurrency }: any) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Projets Totaux" value={data.summary.total_projects} />
                <StatCard label="Projets Actifs" value={data.summary.active_projects} />
                <StatCard label="Taches Completees" value={`${data.summary.completed_tasks}/${data.summary.total_tasks}`} />
                <StatCard label="Ouvriers" value={data.summary.total_workers} />
                <StatCard label="Budget Total" value={formatCurrency(data.summary.total_budget)} />
                <StatCard label="Heures Travaillees" value={`${data.summary.total_working_hours}h`} />
            </div>

            {data.projects_by_status && (
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-base">Projets par Statut</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {Object.entries(data.projects_by_status).map(([status, count]: any) => (
                                <div key={status} className="flex items-center justify-between p-2 rounded border border-border/50">
                                    <span className="capitalize">{status.replace('_', ' ')}</span>
                                    <Badge>{count}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function ProjectReport({ data, formatCurrency, showBudget = true }: { data: any[]; formatCurrency: (n: number) => string; showBudget?: boolean }) {
    return (
        <div className="space-y-4">
            {data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Aucun projet trouve</div>
            ) : (
                data.map((project: any) => (
                    <Card key={project.id} className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{project.name}</CardTitle>
                            <CardDescription>{project.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">Statut</span>
                                    <Badge className="mt-1">{project.status}</Badge>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Dates</span>
                                    <p className="text-sm mt-1">{project.start_date} a {project.deadline}</p>
                                </div>
                                {showBudget && (
                                <div>
                                    <span className="text-xs text-muted-foreground">Budget</span>
                                    <p className="text-sm font-bold mt-1">{formatCurrency(project.budget)}</p>
                                </div>
                                )}
                                <div>
                                    <span className="text-xs text-muted-foreground">Taches</span>
                                    <p className="text-sm mt-1">{project.completed_tasks}/{project.total_tasks}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Ouvriers</span>
                                    <p className="text-sm mt-1">{project.total_workers}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Etapes</span>
                                    <p className="text-sm mt-1">{project.total_steps}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
}

function WorkerReport({ data }: any) {
    return (
        <div className="space-y-4">
            {data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Aucun ouvrier trouve</div>
            ) : (
                data.map((worker: any) => (
                    <Card key={worker.id} className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{worker.name}</CardTitle>
                            <CardDescription>{worker.email}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">Role</span>
                                    <Badge className="mt-1">{worker.role}</Badge>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Taches</span>
                                    <p className="text-sm mt-1">{worker.completed_tasks}/{worker.total_tasks}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Projets</span>
                                    <p className="text-sm font-bold mt-1">{worker.projects_worked_on}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Presence</span>
                                    <p className="text-sm mt-1">{worker.attendance_days}j</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Heures totales</span>
                                    <p className="text-sm font-bold mt-1">{worker.total_working_hours}h</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Moyenne/jour</span>
                                    <p className="text-sm mt-1">{worker.avg_hours_per_day}h</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
}

function ActivitiesReport({ data }: any) {
    return (
        <div className="space-y-6">
            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="text-base">Activites Totales</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold">{data.total_activities}</p>
                </CardContent>
            </Card>

            {data.user_statistics.length > 0 && (
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-base">Activites par Utilisateur</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {data.user_statistics.map((stat: any) => (
                            <div key={stat.user_id} className="flex justify-between items-center p-2 rounded border border-border/50">
                                <span>{stat.user_name || 'Utilisateur supprime'}</span>
                                <Badge>{stat.count}</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function StatCard({ label, value }: any) {
    return (
        <Card className="border-border/50">
            <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="text-2xl font-bold mt-2">{value}</div>
            </CardContent>
        </Card>
    );
}
