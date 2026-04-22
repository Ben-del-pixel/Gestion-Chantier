import { Head, Link, router } from '@inertiajs/react';
import {
  Calendar,
  Circle,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import React from 'react';

import { destroy, show, store } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ProjectItem = {
  id: number;
  name: string;
  description: string | null;
  budget: number | string;
  start_date: string | null;
  deadline: string | null;
  status: string;
  engineer?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
  tasks?: Array<{ workers?: Array<{ id: number }> }>;
};

const STATUS_LABELS: Record<string, string> = {
  initialisation: 'Planification',
  planifie: 'Planification',
  en_cours: 'En cours',
  termine: 'Terminé',
  suspendu: 'Suspendu',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  initialisation: 'bg-slate-100 text-slate-600',
  planifie: 'bg-slate-100 text-slate-600',
  en_cours: 'bg-blue-600 text-white',
  termine: 'bg-emerald-600 text-white',
  suspendu: 'bg-rose-100 text-rose-700',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateRange(startDate: string | null, deadline: string | null): string {
  const format = (value: string | null) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-');

  return `${format(startDate)} - ${format(deadline)}`;
}

function getUniqueWorkerCount(project: ProjectItem): number {
  if (!project.tasks || project.tasks.length === 0) {
    return 0;
  }

  const workers = new Set<number>();

  project.tasks.forEach((task) => {
    task.workers?.forEach((worker) => workers.add(worker.id));
  });

  return workers.size;
}

function getProgress(project: ProjectItem): number {
  if (project.status === 'termine') {
    return 100;
  }

  if (project.status !== 'en_cours') {
    return 0;
  }

  if (!project.start_date || !project.deadline) {
    return 55;
  }

  const start = new Date(project.start_date).getTime();
  const end = new Date(project.deadline).getTime();
  const now = Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 55;
  }

  const ratio = ((now - start) / (end - start)) * 100;

  return Math.max(5, Math.min(95, Math.round(ratio)));
}

export default function ProjectsIndex({ projects, engineers }: { projects: ProjectItem[], engineers: Array<{ id: number, name: string }> }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [openDialog, setOpenDialog] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    start_date: '',
    budget: '',
    deadline: '',
    status: 'initialisation',
    engineer_id: '',
    steps: [{ name: '', budget: '' }],
  });

  const normalizedProjects = React.useMemo(
    () =>
      projects.map((project) => {
        const budget = Number(project.budget || 0);
        const progress = getProgress(project);
        const spent = Math.round((budget * progress) / 100);

        return {
          ...project,
          budget,
          progress,
          spent,
          workerCount: getUniqueWorkerCount(project),
        };
      }),
    [projects]
  );

  const filteredProjects = React.useMemo(() => {
    return normalizedProjects.filter((project) => {
      const statusMatch = statusFilter === 'all' || project.status === statusFilter;
      const searchValue = `${project.name} ${project.description ?? ''} ${project.engineer?.name ?? ''}`.toLowerCase();
      const textMatch = searchValue.includes(searchTerm.toLowerCase());

      return statusMatch && textMatch;
    });
  }, [normalizedProjects, searchTerm, statusFilter]);

  const stats = React.useMemo(() => {
    const totalBudget = normalizedProjects.reduce((sum, project) => sum + project.budget, 0);
    const totalSpent = normalizedProjects.reduce((sum, project) => sum + project.spent, 0);

    return {
      total: normalizedProjects.length,
      inProgress: normalizedProjects.filter((project) => project.status === 'en_cours').length,
      completed: normalizedProjects.filter((project) => project.status === 'termine').length,
      totalBudget,
      totalSpent,
    };
  }, [normalizedProjects]);

  const handleDeleteProject = (project: ProjectItem) => {
    const shouldDelete = window.confirm(`Supprimer le chantier "${project.name}" ?`);

    if (!shouldDelete) {
      return;
    }

    router.delete(destroy.url({ project: project.id }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStepChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [e.target.name]: e.target.value };
    
    // Calculate new total budget
    const totalBudget = newSteps.reduce((sum, step) => sum + (Number(step.budget) || 0), 0);
    
    setFormData((prev) => ({
      ...prev,
      steps: newSteps,
      budget: totalBudget > 0 ? totalBudget.toString() : prev.budget,
    }));
  };

  const addStep = () => {
    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, { name: '', budget: '' }],
    }));
  };

  const removeStep = (index: number) => {
    if (formData.steps.length <= 1) return;
    const newSteps = formData.steps.filter((_, i) => i !== index);
    const totalBudget = newSteps.reduce((sum, step) => sum + (Number(step.budget) || 0), 0);
    
    setFormData((prev) => ({
      ...prev,
      steps: newSteps,
      budget: totalBudget > 0 ? totalBudget.toString() : prev.budget,
    }));
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(store.url(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        alert('Erreur : ' + (error.message || 'Impossible de créer le chantier'));

        return;
      }

      setFormData({ 
        name: '', 
        description: '', 
        start_date: '', 
        budget: '', 
        deadline: '', 
        status: 'initialisation', 
        engineer_id: '',
        steps: [{ name: '', budget: '' }]
      });
      setOpenDialog(false);
      router.visit(`/projects`);
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la création du chantier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head title="Chantiers" />

      <div className="space-y-5">
        <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <h1 className="text-[40px] font-semibold tracking-tight text-slate-900">Gestion des Chantiers</h1>
              <p className="text-lg text-slate-500">Suivi de tous vos chantiers à Lubumbashi</p>
            </div>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau Chantier
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogTitle>Créer un nouveau chantier</DialogTitle>

                <form className="mt-4 space-y-4" onSubmit={handleSubmitProject}>
                  <div>
                    <Label htmlFor="name">Nom du chantier *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      placeholder="Ex: Rénovation Hôtel du Centre"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Localisation / Description</Label>
                    <Input
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      placeholder="Ex: Avenue du Congo, Lubumbashi"
                    />
                  </div>

                  <div>
                    <Label htmlFor="budget">Budget (USD) *</Label>
                    <Input
                      id="budget"
                      name="budget"
                      type="number"
                      value={formData.budget}
                      onChange={handleFormChange}
                      placeholder="50000"
                      required
                      step="0.01"
                    />
                  </div>

                  <div>
                    <Label htmlFor="start_date">Date de démarrage *</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="deadline">Date limite *</Label>
                    <Input
                      id="deadline"
                      name="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Statut *</Label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      required
                    >
                      <option value="initialisation">Planification</option>
                      <option value="planifie">Planification</option>
                      <option value="en_cours">En cours</option>
                      <option value="suspendu">Suspendu</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="engineer_id">Ingénieur responsable</Label>
                    <select
                      id="engineer_id"
                      name="engineer_id"
                      value={formData.engineer_id}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">Sélectionner un ingénieur</option>
                      {engineers.map((eng) => (
                        <option key={eng.id} value={eng.id}>{eng.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Étapes du projet</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addStep}>
                        <Plus className="mr-1 h-3 w-3" />
                        Ajouter étape
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {formData.steps.map((step, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label htmlFor={`step-name-${index}`} className="text-xs">Nom de l'étape</Label>
                            <Input
                              id={`step-name-${index}`}
                              name="name"
                              value={step.name}
                              onChange={(e) => handleStepChange(index, e)}
                              placeholder="Ex: Fondations"
                              className="h-9"
                              required
                            />
                          </div>
                          <div className="w-32">
                            <Label htmlFor={`step-budget-${index}`} className="text-xs">Budget</Label>
                            <Input
                              id={`step-budget-${index}`}
                              name="budget"
                              type="number"
                              value={step.budget}
                              onChange={(e) => handleStepChange(index, e)}
                              placeholder="1000"
                              className="h-9"
                              required
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeStep(index)}
                            className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                            disabled={formData.steps.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      Le budget total sera automatiquement calculé à partir de la somme des budgets des étapes.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Création...' : 'Créer'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="rounded-xl bg-blue-100/70 px-4 py-3">
                <p className="text-sm font-medium text-blue-700">Total Chantiers</p>
                <p className="mt-1 text-4xl font-semibold text-blue-700">{stats.total}</p>
              </div>
              <div className="rounded-xl bg-emerald-100/70 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700">En Cours</p>
                <p className="mt-1 text-4xl font-semibold text-emerald-700">{stats.inProgress}</p>
              </div>
              <div className="rounded-xl bg-violet-100/70 px-4 py-3">
                <p className="text-sm font-medium text-violet-700">Terminés</p>
                <p className="mt-1 text-4xl font-semibold text-violet-700">{stats.completed}</p>
              </div>
              <div className="rounded-xl bg-amber-100/70 px-4 py-3">
                <p className="text-sm font-medium text-amber-700">Budget Total</p>
                <p className="mt-1 text-4xl font-semibold text-amber-700">{formatCurrency(stats.totalBudget)}</p>
              </div>
              <div className="rounded-xl bg-rose-100/70 px-4 py-3">
                <p className="text-sm font-medium text-rose-700">Dépensé</p>
                <p className="mt-1 text-4xl font-semibold text-rose-700">{formatCurrency(stats.totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Rechercher par nom, localisation, responsable..."
                className="h-11 rounded-xl border-slate-300 bg-white pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-300 bg-white md:w-[200px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="initialisation">Planification</SelectItem>
                <SelectItem value="suspendu">Suspendu</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
              <CardHeader className="space-y-3 pb-4">
                <CardTitle className="text-[28px] font-semibold leading-tight text-slate-900">{project.name}</CardTitle>

                <Badge className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[project.status] || STATUS_BADGE_CLASS.initialisation}`}>
                  {STATUS_LABELS[project.status] || STATUS_LABELS.initialisation}
                </Badge>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4" />
                  <span>{project.description || 'Lubumbashi'}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-600">Progression</span>
                    <span className="font-semibold text-slate-700">{project.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-600">Budget utilisé</span>
                    <span className="font-semibold text-slate-700">{project.progress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatCurrency(project.spent)} dépensé</span>
                    <span>{formatCurrency(project.budget)} budget</span>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-200 pt-3 text-[13px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateRange(project.start_date, project.deadline)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                      {project.workerCount} travailleur(s) • {project.engineer?.name ?? project.manager?.name ?? 'Non assigné'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                  <Button asChild variant="outline" className="h-10 rounded-xl border-blue-200 bg-blue-50 font-semibold text-blue-600 hover:bg-blue-100">
                    <Link href={show.url({ project: project.id })}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDeleteProject(project)}
                    className="h-10 rounded-xl border-rose-200 bg-rose-50 font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 py-10 text-center shadow-sm">
            <CardContent className="space-y-2">
              <Circle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="text-base font-medium text-slate-600">Aucun chantier trouvé</p>
              <p className="text-sm text-slate-500">Ajuste la recherche ou le filtre de statut.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
