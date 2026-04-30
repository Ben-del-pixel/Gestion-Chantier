import { Head, router, usePage } from '@inertiajs/react';
import { 
  Calendar, DollarSign, MapPin, User, Save, Users, 
  Trash2, Edit, ChevronRight, Activity, Clock, 
  HardHat, Wallet, FileText, Plus, CheckCircle,
  LayoutGrid, ListChecks, Settings2, Info, AlertCircle
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { update, destroy } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

export default function ProjectDetail({ project, totalWorkersCount, engineers, storekeepers, allWorkers }: any) {
    const { currency, setCurrency, formatCurrency } = useCurrency();
    const { errors }: any = usePage().props;
  const [isEditing, setIsEditing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
    budget: project.budget,
    progress: project.progress || 0,
    start_date: project.start_date ? project.start_date.split('T')[0] : '',
    deadline: project.deadline ? project.deadline.split('T')[0] : '',
    status: project.status,
    engineer_id: project.engineer_id || '',
    storekeeper_id: project.storekeeper_id || '',
    steps: project.steps.map((s: any) => ({ 
        id: s.id, 
        name: s.name, 
        budget: s.budget 
    })) || []
  });

  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>(
    project.workers?.map((w: any) => w.id) || []
  );

  const statusOptions = [
    { value: 'initialisation', label: 'Initialisation', color: 'slate' },
    { value: 'planifie', label: 'Planifié', color: 'indigo' },
    { value: 'en_cours', label: 'En cours', color: 'blue' },
    { value: 'termine', label: 'Terminé', color: 'emerald' },
    { value: 'suspendu', label: 'Suspendu', color: 'rose' },
  ];

  const getStatusTheme = (statusVal: string) => {
    const found = statusOptions.find(o => o.value === statusVal);

    return found ? found.color : 'slate';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) {
return 'Non défini';
}

    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    router.put(`/projects/${project.id}`, formData, {
      onSuccess: () => {
        setIsEditing(false);
        setIsLoading(false);
      },
      onError: (errs) => {
        console.error(errs);
        setIsLoading(false);
      },
      onFinish: () => setIsLoading(false)
    });
  };

  const handleAssignWorkers = () => {
    setIsLoading(true);

    router.post(`/api/projects/${project.id}/workers`, { worker_ids: selectedWorkerIds }, {
      onSuccess: () => {
        setIsAssigning(false);
        setIsLoading(false);
      },
      onError: (err) => {
        console.error(err);
        setIsLoading(false);
      },
      onFinish: () => setIsLoading(false)
    });
  };

  const handleDelete = () => {
    if (!confirm('Toutes les données associées seront perdues. Confirmer?')) {
      return;
    }

    router.delete(`/projects/${project.id}`, {
      onError: (err) => {
        console.error(err);
      }
    });
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { name: '', budget: 0 }]
    });
  };

  const removeStep = (idx: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_: any, i: number) => i !== idx)
    });
  };

  const updateStep = (idx: number, field: string, val: any) => {
    const newSteps = [...formData.steps];
    newSteps[idx] = { ...newSteps[idx], [field]: val };
    setFormData({ ...formData, steps: newSteps });
  };

  return (
    <>
      <Head title={`Chantier : ${project.name}`} />

      <div className="relative space-y-8 pb-20">
        {/* Background Decor */}
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(79,70,229,0.05),transparent_35%)]" />

        {/* Header Section */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-slate-900">{project.name}</h1>
              <Badge className={cn(
                "rounded-full px-4 py-1 text-[11px] font-black uppercase tracking-widest border-0",
                project.status === 'en_cours' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" :
                project.status === 'termine' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
                "bg-slate-500 text-white"
              )}>
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-lg text-slate-500 font-medium max-w-2xl">{project.description || 'Aucune description disponible pour ce projet.'}</p>
          </div>

          <div className="flex flex-wrap gap-3">
                        <select
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value as 'USD' | 'CDF')}
                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
                        >
                            <option value="USD">USD ($)</option>
                            <option value="CDF">FC (CDF)</option>
                        </select>
            <Button variant="outline" onClick={() => setIsEditing(true)} className="h-11 rounded-xl border-slate-200 bg-white px-6 font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50">
              <Edit className="mr-2 h-4 w-4 text-blue-500" />
              Modifier Projet
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="h-11 rounded-xl px-6 font-bold shadow-lg shadow-red-500/20">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Top Grid: Major Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailStatCard title="Budget Total" value={formatCurrency(Number(project.budget || 0))} icon={Wallet} color="emerald" sub="Financement alloué" />
          <DetailStatCard title="Main d'œuvre" value={totalWorkersCount} icon={Users} color="blue" sub="Ouvriers actifs" />
          <DetailStatCard title="Date Butoir" value={formatDate(project.deadline)} icon={Clock} color="amber" sub="Échéance prévue" />
          <DetailStatCard title="Localisation" value="Site Central" icon={MapPin} color="rose" sub="Lieu du chantier" />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Personnel & Management */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                           <Settings2 className="h-4 w-4 text-blue-500" /> 
                           Responsables
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <PersonnelItem 
                            label="Ingénieur Responsable" 
                            name={project.engineer?.name} 
                            email={project.engineer?.email} 
                            role="Responsable Technique" 
                            icon={HardHat}
                            iconColor="orange"
                        />
                        <PersonnelItem 
                            label="Magasinier Assigné" 
                            name={project.storekeeper?.name} 
                            email={project.storekeeper?.email} 
                            role="Gestion de Stocks" 
                            icon={LayoutGrid}
                            iconColor="blue"
                        />
                        <PersonnelItem 
                            label="Gérant Créateur" 
                            name={project.manager?.name} 
                            email={project.manager?.email} 
                            role="Administrateur" 
                            icon={User}
                            iconColor="purple"
                        />
                    </CardContent>
                </Card>

                <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Équipe Terrain</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setIsAssigning(true)} className="h-8 text-[11px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg">
                            GÉRER L'ÉQUIPE
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {project.workers?.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {project.workers.map((w: any) => (
                                    <div key={w.id} className={cn(
                                        "flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all group",
                                        w.role === 'magasinier' 
                                            ? "bg-purple-50 border-purple-100 hover:border-purple-300 hover:bg-white" 
                                            : "bg-slate-50 border-slate-100 hover:border-blue-200 hover:bg-white"
                                    )}>
                                        <div className={cn(
                                            "h-2 w-2 rounded-full group-hover:scale-125 transition-transform",
                                            w.role === 'magasinier' ? "bg-purple-400" : "bg-blue-400"
                                        )} />
                                        <span className={cn(
                                            "text-xs font-bold",
                                            w.role === 'magasinier' ? "text-purple-700" : "text-slate-700"
                                        )}>
                                            {w.name} {w.role === 'magasinier' && <span className="opacity-60 font-normal ml-1">(Magasinier)</span>}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-sm italic font-medium">
                                Aucun ouvrier affecté à ce projet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Steps & Tasks */}
            <div className="lg:col-span-8 space-y-6">
                {/* Steps Section */}
                <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
                    <CardHeader className="border-b border-slate-50 px-8 py-7">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-3">
                                <ListChecks className="h-5 w-5 text-emerald-500" />
                                Étapes de réalisation
                            </CardTitle>
                            <Badge variant="outline" className="rounded-lg border-emerald-100 bg-emerald-50 text-emerald-700 font-bold px-3 py-1">
                                {project.steps?.length || 0} Phases
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {project.steps?.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {project.steps.map((step: any, idx: number) => (
                                    <div key={step.id} className="flex items-center justify-between px-8 py-6 transition-all hover:bg-slate-50/50 group">
                                        <div className="flex items-center gap-6">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 font-black text-sm shadow-sm group-hover:border-emerald-200 group-hover:text-emerald-500 transition-all">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900">{step.name}</h4>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Budget Phase {idx + 1}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-emerald-600">{formatCurrency(Number(step.budget || 0))}</div>
                                            <div className="flex items-center justify-end gap-1 text-[10px] font-black text-slate-300 uppercase italic">
                                                <CheckCircle className="h-2.5 w-2.5" />
                                                Planifié
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
                                    <ListChecks className="h-8 w-8 text-slate-200" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Aucune étape définie</h3>
                                <p className="text-sm text-slate-500 max-w-xs mx-auto">Veuillez éditer le projet pour ajouter des phases de travail.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Tasks Section */}
                <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
                    <CardHeader className="border-b border-slate-50 px-8 py-7">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-900">
                                <Activity className="h-5 w-5 text-blue-500" />
                                Tâches Planifiées
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        {project.tasks?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {project.tasks.map((task: any) => (
                                    <div key={task.id} className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3">
                                            <Badge variant="outline" className="rounded-full bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                                                {task.status}
                                            </Badge>
                                        </div>
                                        <div className="space-y-3">
                                            <h5 className="font-bold text-slate-900 pr-16">{task.name}</h5>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">{task.description}</p>
                                            
                                            <div className="pt-2 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(task.start_date)}
                                                </div>
                                                <div className="flex -space-x-2">
                                                    {task.workers?.map((w: any) => (
                                                        <div key={w.id} className="h-6 w-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-blue-600" title={w.name}>
                                                            {w.name.charAt(0)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                                <p className="text-slate-400 font-bold italic">Aucune tâche assignée à ce jour.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* MODALS SECTION */}
        
        {/* EDIT PROJECT MODAL */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogContent className="max-w-4xl p-0 border-0 rounded-3xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
                <div className="bg-slate-900 p-8 text-white relative">
                    <DialogTitle className="text-2xl font-black italic tracking-tight">Configuration Chantier</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1">Mise à jour des paramètres structurels du projet</DialogDescription>
                </div>
                
                <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto px-8 py-4 space-y-4 scrollbar-hide">
                    {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-900 rounded-2xl mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="font-black uppercase text-xs">Erreur de validation</AlertTitle>
                            <AlertDescription className="text-xs font-bold">
                                {Object.values(errors).map((err: any, i) => (
                                    <div key={i}>{Array.isArray(err) ? err[0] : err}</div>
                                ))}
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Informations de base
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Nom du projet</Label>
                                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl focus:ring-blue-500/20" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Description</Label>
                                    <textarea 
                                        value={formData.description} 
                                        onChange={(e: any) => setFormData({...formData, description: e.target.value})} 
                                        className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500/20" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-400">Date Début</Label>
                                        <Input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="h-12 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-400">Deadline</Label>
                                        <Input type="date" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className="h-12 rounded-xl" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
                                <Users className="h-3 w-3" /> Encadrement & Statut
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Ingénieur Responsable</Label>
                                    <select value={formData.engineer_id} onChange={e => setFormData({...formData, engineer_id: e.target.value})} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-orange-500/20 appearance-none">
                                        <option value="">Sélectionner un ingénieur...</option>
                                        {engineers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Magasinier</Label>
                                    <select value={formData.storekeeper_id} onChange={e => setFormData({...formData, storekeeper_id: e.target.value})} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500/20 appearance-none">
                                        <option value="">Sélectionner un magasinier...</option>
                                        {storekeepers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Statut de réalisation</Label>
                                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500/20 appearance-none">
                                        {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-400">Progression globale (%)</Label>
                                    <Input type="number" min="0" max="100" value={formData.progress} onChange={e => setFormData({...formData, progress: parseInt(e.target.value) || 0})} className="h-12 rounded-xl focus:ring-blue-500/20" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                <LayoutGrid className="h-3 w-3" /> Étapes & Budgets
                            </h3>
                            <Button type="button" variant="outline" size="sm" onClick={addStep} className="h-8 rounded-lg text-[11px] font-black italic">
                                + AJOUTER ÉTAPE
                            </Button>
                        </div>
                        
                        <div className="space-y-3">
                            {formData.steps.map((step: any, idx: number) => (
                                <div key={idx} className="flex items-end gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 group transition-all hover:bg-white hover:border-emerald-200">
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Titre Phase {idx + 1}</Label>
                                        <Input value={step.name} onChange={e => updateStep(idx, 'name', e.target.value)} className="h-10 border-0 bg-transparent text-sm font-black focus:ring-0 px-0 rounded-none border-b border-transparent focus:border-emerald-500" placeholder="Ex: Fondations..." />
                                    </div>
                                    <div className="w-40 space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Budget ({currency})</Label>
                                        <Input type="number" value={step.budget} onChange={e => updateStep(idx, 'budget', e.target.value)} className="h-10 border-0 bg-transparent text-sm font-black text-emerald-600 focus:ring-0 px-0 rounded-none border-b border-transparent focus:border-emerald-500" />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(idx)} className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3 flex-shrink-0">
                    <Button type="submit" disabled={isLoading} onClick={handleUpdate} className="flex-1 h-12 rounded-xl bg-slate-900 font-bold text-white shadow-lg shadow-slate-900/10">
                        {isLoading ? 'Enregistrement...' : 'Sauvegarder les modifications'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="h-12 px-8 rounded-xl font-bold">Annuler</Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* ASSIGN WORKERS MODAL */}
        <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
            <DialogContent className="max-w-md p-0 border-0 rounded-3xl overflow-hidden bg-white">
                <div className="bg-blue-600 p-8 text-white">
                    <DialogTitle className="text-2xl font-black tracking-tight">Affectation Main d'Œuvre</DialogTitle>
                    <DialogDescription className="text-blue-100 opacity-80">Sélectionnez les ouvriers affectés à ce chantier</DialogDescription>
                </div>
                <div className="p-8 space-y-6">
                    {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-900 rounded-2xl">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs font-bold">
                                {Object.values(errors).map((err: any, i) => (
                                    <div key={i}>{Array.isArray(err) ? err[0] : err}</div>
                                ))}
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                        {allWorkers.map((worker: any) => (
                            <label key={worker.id} className={cn(
                                "flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer group",
                                selectedWorkerIds.includes(worker.id) ? "border-blue-500 bg-blue-50" : "border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200"
                            )}>
                                <div className={cn(
                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                    selectedWorkerIds.includes(worker.id) ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200"
                                )}>
                                    {selectedWorkerIds.includes(worker.id) && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={selectedWorkerIds.includes(worker.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
setSelectedWorkerIds([...selectedWorkerIds, worker.id]);
} else {
setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== worker.id));
}
                                    }}
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-slate-800">{worker.name}</div>
                                    <div className={cn(
                                        "text-[10px] font-bold uppercase tracking-widest",
                                        worker.role === 'magasinier' ? "text-purple-500" : "text-slate-400"
                                    )}>
                                        {worker.role === 'magasinier' ? 'Magasinier' : (worker.skills || 'Ouvrier Polyvalent')}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="p-8 pt-0 flex gap-3">
                    <Button onClick={handleAssignWorkers} disabled={isLoading} className="flex-1 h-12 rounded-xl bg-blue-600 font-bold shadow-lg shadow-blue-500/30">
                        {isLoading ? 'Mise à jour...' : `Assigner ${selectedWorkerIds.length} ouvriers`}
                    </Button>
                    <Button variant="outline" onClick={() => setIsAssigning(false)} className="h-12 rounded-xl px-6">Annuler</Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

function DetailStatCard({ title, value, icon: Icon, color, sub }: any) {
    const themes: any = {
        blue: "bg-blue-500 text-white shadow-blue-500/20",
        emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
        amber: "bg-amber-500 text-white shadow-amber-500/20",
        rose: "bg-rose-500 text-white shadow-rose-500/20",
    }

    return (
        <Card className="border-0 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] group">
            <CardContent className="p-7">
                <div className="flex items-center justify-between pb-4">
                    <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", themes[color])}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
                        <h3 className="text-2xl font-black text-slate-900 mt-1">{value}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                    <div className="h-1 w-8 rounded-full bg-slate-100 overflow-hidden">
                        <div className={cn("h-full w-full", `bg-${color}-500`)} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{sub}</span>
                </div>
            </CardContent>
        </Card>
    );
}

function PersonnelItem({ label, name, email, role, icon: Icon, iconColor }: any) {
    const colors: any = {
        orange: "bg-orange-500 text-white",
        blue: "bg-blue-500 text-white",
        purple: "bg-purple-500 text-white",
    }

    return (
        <div className="flex items-start gap-4 p-4 rounded-2xl border border-slate-50 bg-slate-50/30 transition-all hover:bg-white hover:border-slate-200">
            <div className={cn("h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center", colors[iconColor])}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <Label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">{label}</Label>
                <div className="font-bold text-slate-900">{name || <span className="text-slate-300 italic">Non assigné</span>}</div>
                <div className="text-[11px] font-bold text-slate-500">{role}</div>
                {email && <div className="text-[10px] text-blue-500 mt-1 cursor-pointer hover:underline">{email}</div>}
            </div>
        </div>
    );
}
