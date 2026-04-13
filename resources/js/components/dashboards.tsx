import { router } from '@inertiajs/react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
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
    AlertCircle
} from 'lucide-react';
import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { store } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title
);

const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, string> = {
        en_cours: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-100 dark:border-blue-800",
        initialisation: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-100 dark:border-slate-800",
        termine: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
        planifie: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800",
    };
    
    return (
        <Badge variant="outline" className={`${variants[status] || variants.initialisation} px-2 py-0 h-6 text-[11px] font-semibold border`}>
            {status.replace('_', ' ')}
        </Badge>
    );
};

const StatCard = ({ title, value, subValue, icon: Icon, trend, trendValue }: any) => {
    return (
        <Card className="shadow-none group border-border/50 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6">
                <div className="flex items-center justify-between pb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                    <h4 className="text-2xl font-bold tracking-tight">{value}</h4>
                    {(trendValue || subValue) && (
                        <div className="flex items-center gap-1.5 pt-1">
                            {trendValue && (
                                <span className={`inline-flex items-center text-[11px] font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
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

export const ManagerDashboard = ({ projects, stats, engineers }: any) => {
    // --- État pour la modale de création de projet ---
    const [open, setOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [projectName, setProjectName] = React.useState('');
    const [projectDesc, setProjectDesc] = React.useState('');
    const [deadline, setDeadline] = React.useState('');
    const [engineerId, setEngineerId] = React.useState('');
    const [steps, setSteps] = React.useState([{ name: '', budget: '' }]);
    const [manualBudget, setManualBudget] = React.useState('');

    // Calculate total budget from steps
    const calculatedBudget = React.useMemo(() => {
        return steps.reduce((sum, step) => {
            return sum + (parseFloat(step.budget) || 0);
        }, 0);
    }, [steps]);

    const finalBudget = manualBudget ? parseFloat(manualBudget) : calculatedBudget;

    const handleStepChange = (idx: number, field: 'name' | 'budget', value: string) => {
        setSteps(steps => steps.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    };
    const addStep = () => setSteps(steps => [...steps, { name: '', budget: '' }]);
    const removeStep = (idx: number) => setSteps(steps => steps.length > 1 ? steps.filter((_, i) => i !== idx) : steps);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const payload = {
                name: projectName,
                description: projectDesc,
                deadline: deadline,
                engineer_id: engineerId ? parseInt(engineerId) : null,
                steps: steps.map(s => ({
                    name: s.name,
                    budget: parseFloat(s.budget)
                })),
                ...(manualBudget && { budget: finalBudget })
            };

            const response = await fetch(store.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Error:', error);
                alert('Erreur lors de la création du projet');

                return;
            }

            // Reset form
            setProjectName('');
            setProjectDesc('');
            setDeadline('');
            setEngineerId('');
            setSteps([{ name: '', budget: '' }]);
            setManualBudget('');
            setOpen(false);

            // Refresh dashboard
            router.visit('/dashboard');
        } catch (error) {
            console.error('Error:', error);
            alert('Erreur lors de la création du projet');
        } finally {
            setIsLoading(false);
        }
    };

    const barData = {
        labels: projects.map((p: any) => p.name.length > 12 ? p.name.substring(0, 10) + '...' : p.name),
        datasets: [{
            label: 'Budget (€)',
            data: projects.map((p: any) => p.budget),
            backgroundColor: 'hsl(var(--primary))',
            borderRadius: 4,
            barThickness: 20,
        }]
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Directeur Général</h1>
                    <p className="text-sm text-muted-foreground">Supervision stratégique des actifs et budget.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Rapports</Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm">Nouveau Site</Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto">
                            <DialogTitle>Créer un nouveau projet</DialogTitle>
                            <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
                                <div>
                                    <Label htmlFor="project-name">Nom du projet *</Label>
                                    <Input id="project-name" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="ex: Chantier Centre Ville" required />
                                </div>
                                <div>
                                    <Label htmlFor="project-desc">Description</Label>
                                    <Input id="project-desc" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} placeholder="ex: Rénovation complète du centre ville" />
                                </div>
                                <div>
                                    <Label htmlFor="deadline">Date limite *</Label>
                                    <Input id="deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} required />
                                </div>
                                <div>
                                    <Label htmlFor="engineer-id">Ingénieur assigné</Label>
                                    {engineers && engineers.length > 0 ? (
                                        <select
                                            id="engineer-id"
                                            value={engineerId}
                                            onChange={e => setEngineerId(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                                        >
                                            <option value="">-- Sélectionner un ingénieur --</option>
                                            {engineers.map((eng: any) => (
                                                <option key={eng.id} value={eng.id}>
                                                    {eng.name} ({eng.email})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="text-sm text-amber-600 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                            ⚠️ Aucun ingénieur disponible. <a href="/users" className="font-semibold underline">Créez d'abord les utilisateurs</a>
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label>Étapes & Budgets</Label>
                                        <span className="text-sm font-semibold text-primary">Total calculé: {calculatedBudget.toLocaleString('fr-FR')} €</span>
                                    </div>
                                    {steps.map((step, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <Input placeholder={`Étape ${idx + 1}`} value={step.name} onChange={e => handleStepChange(idx, 'name', e.target.value)} required className="flex-1" />
                                            <Input placeholder="Budget (€)" type="number" min="0" step="0.01" value={step.budget} onChange={e => handleStepChange(idx, 'budget', e.target.value)} required className="w-32" />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(idx)} disabled={steps.length === 1}>-</Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addStep}>+ Ajouter une étape</Button>
                                </div>
                                <div>
                                    <Label htmlFor="manual-budget">Budget final (optionnel - laisser vide pour utiliser le total calculé)</Label>
                                    <Input id="manual-budget" type="number" min="0" step="0.01" value={manualBudget} onChange={e => setManualBudget(e.target.value)} placeholder={calculatedBudget.toLocaleString('fr-FR')} />
                                    {manualBudget && parseFloat(manualBudget) !== calculatedBudget && (
                                        <p className="text-xs text-amber-600 mt-1">⚠️ Budget différent du total calculé ({finalBudget.toLocaleString('fr-FR')} € au lieu de {calculatedBudget.toLocaleString('fr-FR')} €)</p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Annuler</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isLoading}>{isLoading ? 'Création...' : 'Créer le projet'}</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Budget Total" value={`${(stats.total_budget / 1000).toFixed(1)}k €`} subValue={`${projects.length} chantier(s)`} icon={TrendingUp} />
                <StatCard title="Chantiers Actifs" value={stats.active_projects} subValue="En cours actuellement" icon={MapPin} />
                <StatCard title="Total Effectif" value={stats.total_workers} subValue="Ouvriers disponibles" icon={Users} />
                <StatCard title="Missions" value={stats.total_tasks} subValue="Tâches à accomplir" icon={CheckCircle2} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <Card className="lg:col-span-8 shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-8">
                        <CardTitle className="text-lg font-bold">Analyse Budgétaire par Site</CardTitle>
                        <CardDescription className="text-xs">Visualisation de l'engagement financier par chantier</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <Bar
                                data={barData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        y: { grid: { color: 'rgba(216, 226, 236, 0.2)' }, ticks: { font: { size: 10, family: 'Inter' }, color: 'hsl(var(--muted-foreground))' } },
                                        x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: 'hsl(var(--muted-foreground))' } }
                                    }
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 shadow-none border-border/50 bg-card/60 backdrop-blur-sm flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-center">Engagement Global</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center gap-8 pb-10">
                        <div className="relative w-44 h-44 mx-auto group">
                            <Doughnut
                                data={{
                                    datasets: [{
                                        data: [28, 72],
                                        backgroundColor: ['hsl(var(--primary))', 'hsl(var(--muted))'],
                                        borderWidth: 0
                                    }]
                                }}
                                options={{
                                    plugins: { legend: { display: false } },
                                    cutout: '82%'
                                }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-bold tracking-tighter">28%</span>
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">Consommé</span>
                            </div>
                        </div>
                        <div className="space-y-3 px-2">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="flex items-center gap-2 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-primary"></div>Réalisé</span>
                                <span className="font-bold underline decoration-primary/20">72,000 €</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="flex items-center gap-2 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-slate-200"></div>Prévisionnel</span>
                                <span className="font-bold underline decoration-slate-200">180,000 €</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-6">
                    <div>
                        <CardTitle className="text-lg font-bold">Chantiers en cours</CardTitle>
                        <CardDescription className="text-xs">Dernière mise à jour des données de terrain</CardDescription>
                    </div>
                </CardHeader>
                <div className="overflow-x-auto border-t">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b">Chantier</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b">Superviseur</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b">Progression</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {projects.map((p: any) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="font-bold text-[14px] text-foreground tracking-tight">{p.name}</div>
                                        <div className="text-[11px] text-muted-foreground italic h-4 truncate overflow-hidden">{p.description}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                {p.engineer?.name.split(' ').map((n: any) => n[0]).join('')}
                                            </div>
                                            <span className="text-sm font-medium">{p.engineer?.name || 'Inconnu'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-1.5 w-32">
                                            <div className="flex justify-between text-[10px] font-bold uppercase py-0.5">
                                                <span>Flux</span>
                                                <span className="text-primary">{p.status === 'termine' ? '100' : '35'}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                <div className={`h-full bg-primary transition-all duration-1000`} style={{ width: p.status === 'termine' ? '100%' : '35%' }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <Button size="icon" variant="ghost" className="rounded-xl h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export const EngineerDashboard = ({ tasks, stats }: any) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-end justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Espace Ingénierie</h1>
                    <p className="text-sm text-muted-foreground">Superviser l'ordonnancement et les ressources humaines.</p>
                </div>
                <Button size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm"><PlusCircle className="mr-2 h-4 w-4" />Nouvelle Tâche</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={ClipboardCheck} title="Missions Actives" value={stats?.active_tasks || 0} subValue="Processus en cours" />
                <StatCard icon={HardHat} title="Personnel Site" value={stats?.total_workers_under || 0} subValue="Ouvriers affectés" />
                <StatCard icon={Clock} title="Heures Chantier" value="142h" subValue="Semaine en cours" />
            </div>

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

export const WorkerDashboard = ({ tasks }: any) => {
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
