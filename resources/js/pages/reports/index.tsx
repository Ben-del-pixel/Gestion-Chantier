import { Head, router } from '@inertiajs/react';
import { Calendar, Download, FileText, Filter, Send, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';

import { generate, submit } from '@/actions/App/Http/Controllers/ReportController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ReportsIndex({
    reportTypes,
    projects: initialProjects,
    canSubmitReport,
    submitTargetLabel,
    receivedReports,
    sentReports,
}: any) {
    const formControlClass =
        'h-11 w-full rounded-xl border border-border/60 bg-background/90 px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40';
    const formTextareaClass =
        'min-h-[140px] w-full rounded-xl border border-border/60 bg-background/90 px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40';

    const [selectedReport, setSelectedReport] = useState('global');
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
                throw new Error('Failed to generate report');
            }

            const data = await response.json();
            setReportData(data);
        } catch (error) {
            console.error('Error:', error);
            alert('Erreur lors de la generation du rapport');
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

        setSubmitLoading(true);

        router.post(
            submit.url(),
            {
                title: submissionForm.title,
                content: submissionForm.content,
                project_id: submissionForm.project_id || null,
            },
            {
                onSuccess: () => {
                    setSubmissionForm({ title: '', content: '', project_id: '' });
                },
                onError: () => {
                    alert('Erreur lors de la soumission du rapport');
                },
                onFinish: () => {
                    setSubmitLoading(false);
                },
            }
        );
    };

    const handleDownloadReport = () => {
        if (!reportData) {
            return;
        }

        const content = generateReportContent();
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(content));
        element.setAttribute('download', `rapport_${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const generateReportContent = (): string => {
        let content = `Rapport ${reportData.type}\n`;
        content += `Genere le,${new Date().toLocaleString('fr-FR')}\n`;
        content += `Periode,${reportData.period.start_date || 'Debut'} a ${reportData.period.end_date || 'Fin'}\n\n`;

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
        let content = 'Resume Global\n';
        content += `Projets totaux,${d.summary.total_projects}\n`;
        content += `Projets actifs,${d.summary.active_projects}\n`;
        content += `Projets completes,${d.summary.completed_projects}\n`;
        content += `Taches totales,${d.summary.total_tasks}\n`;
        content += `Taches completees,${d.summary.completed_tasks}\n`;
        content += `Budget total €,${d.summary.total_budget}\n`;
        content += `Ouvriers,${d.summary.total_workers}\n`;
        content += `Heures travaillees,${d.summary.total_working_hours}\n\n`;

        content += 'Projets par statut\n';
        Object.entries(d.projects_by_status).forEach(([status, count]: any) => {
            content += `${status},${count}\n`;
        });

        return content;
    };

    const generateProjectContent = (): string => {
        const selectedProjects = reportData.data;
        let content = 'Nom,Statut,Debut,Fin,Budget €,Manager,Ingenieur,Taches completees,Ouvriers,Etapes\n';
        selectedProjects.forEach((p: any) => {
            content += `${p.name},${p.status},${p.start_date},${p.deadline},${p.budget},${p.manager || '-'},${p.engineer || '-'},${p.completed_tasks}/${p.total_tasks},${p.total_workers},${p.total_steps}\n`;
        });

        return content;
    };

    const generateWorkerContent = (): string => {
        const selectedWorkers = reportData.data;
        let content = 'Nom,Email,Role,Taches completees,Projets,Jours presents,Heures totales,Moyenne/jour\n';
        selectedWorkers.forEach((w: any) => {
            content += `${w.name},${w.email},${w.role},${w.completed_tasks}/${w.total_tasks},${w.projects_worked_on},${w.attendance_days},${w.total_working_hours},${w.avg_hours_per_day}\n`;
        });

        return content;
    };

    const generateActivitiesContent = (): string => {
        const d = reportData.data;
        let content = `Activites totales,${d.total_activities}\n\n`;
        content += 'Par action\n';
        Object.entries(d.action_statistics).forEach(([action, count]: any) => {
            content += `${action},${count}\n`;
        });
        content += '\nPar utilisateur\n';
        d.user_statistics.forEach((s: any) => {
            content += `${s.user_name || 'Inconnu'},${s.count}\n`;
        });

        return content;
    };

    return (
        <>
            <Head title="Rapports" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rapports</h1>
                    <p className="text-sm text-muted-foreground">Generez, redigez et soumettez les rapports.</p>
                </div>

                {canSubmitReport && (
                    <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
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
                                            required
                                        />
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
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={submitLoading} className="rounded-lg gap-2">
                                        <Send className="h-4 w-4" />
                                        {submitLoading ? 'Soumission...' : 'Soumettre'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Rapports recus</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                            {(receivedReports || []).length > 0 ? (
                                receivedReports.map((report: any) => (
                                    <div key={report.id} className="rounded-lg border border-border/60 p-3">
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

                    <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Rapports envoyes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                            {(sentReports || []).length > 0 ? (
                                sentReports.map((report: any) => (
                                    <div key={report.id} className="rounded-lg border border-border/60 p-3">
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

                <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
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
                                        {reportTypes.map((type: any) => (
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
                                            <option value="">-- Tous les projets --</option>
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

                {reportData && (
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
                            {selectedReport === 'global' && <GlobalReport data={reportData.data} />}
                            {selectedReport === 'project' && <ProjectReport data={reportData.data} />}
                            {selectedReport === 'worker' && <WorkerReport data={reportData.data} />}
                            {selectedReport === 'activities' && <ActivitiesReport data={reportData.data} />}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

function GlobalReport({ data }: any) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Projets Totaux" value={data.summary.total_projects} />
                <StatCard label="Projets Actifs" value={data.summary.active_projects} />
                <StatCard label="Taches Completees" value={`${data.summary.completed_tasks}/${data.summary.total_tasks}`} />
                <StatCard label="Ouvriers" value={data.summary.total_workers} />
                <StatCard label="Budget Total" value={`${Math.round(data.summary.total_budget)} €`} />
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

function ProjectReport({ data }: any) {
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
                                <div>
                                    <span className="text-xs text-muted-foreground">Budget</span>
                                    <p className="text-sm font-bold mt-1">{project.budget} €</p>
                                </div>
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
