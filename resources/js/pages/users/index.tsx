import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Search, Trash2, UserPlus, Users, TrendingUp, History as ActivityIcon, UsersRound } from 'lucide-react';
import React from 'react';

import { destroy, index, store, update } from '@/actions/App/Http/Controllers/UserController';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import type { UserRoleValue } from '@/Enums/UserRole';
import { UserRole } from '@/Enums/UserRole';

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: UserRoleValue;
  phone: string | null;
  skills: string | null;
  status: 'Actif' | 'Inactif' | 'Congé';
  engineer_id: number | null;
  engineer?: { id: number; name: string } | null;
  chef_chantier_id: number | null;
  chefChantier?: { id: number; name: string } | null;
};

type AssignableWorker = {
  id: number;
  name: string;
  chef_chantier_id: number | null;
};

type WorkforceRow = UserItem & {
  roleLabel: string;
  phone: string;
  salary: number;
  status: 'Actif' | 'Congé' | 'Inactif';
  skillsList: string[];
};

const ROLE_LABELS: Record<string, string> = {
  [UserRole.Manager.value]: 'Directeur',
  [UserRole.Engineer.value]: 'Ingénieur',
  [UserRole.Worker.value]: 'Ouvrier',
  [UserRole.Magasinier.value]: 'Magasinier',
  [UserRole.ChefChantier.value]: 'Chef chantier',
};

const BASE_SALARY_BY_ROLE: Record<string, number> = {
  [UserRole.Manager.value]: 2200,
  [UserRole.Engineer.value]: 1700,
  [UserRole.Worker.value]: 780,
  [UserRole.Magasinier.value]: 860,
  [UserRole.ChefChantier.value]: 1250,
};

const SKILLS_BY_ROLE: Record<string, string[]> = {
  [UserRole.Manager.value]: ['Pilotage', 'Budget'],
  [UserRole.Engineer.value]: ['AutoCAD', 'Structure'],
  [UserRole.Worker.value]: ['Coffrage', 'Béton'],
  [UserRole.Magasinier.value]: ['Stock', 'Logistique'],
  [UserRole.ChefChantier.value]: ['Coordination', 'Sécurité'],
};

function formatPhone(userId: number): string {
  const suffix = (970000000 + userId * 37).toString().slice(-9);

  return `+243 ${suffix.slice(0, 3)} ${suffix.slice(3, 6)} ${suffix.slice(6, 9)}`;
}

function resolveStatus(userId: number): WorkforceRow['status'] {
  if (userId % 7 === 0) {
    return 'Congé';
  }

  if (userId % 5 === 0) {
    return 'Inactif';
  }

  return 'Actif';
}

export default function UsersIndex({
  users,
  engineers,
  chefChantiers,
  assignableWorkers = [],
}: {
  users: UserItem[];
  engineers: { id: number; name: string }[];
  chefChantiers: { id: number; name: string }[];
  assignableWorkers?: AssignableWorker[];
}) {
  const page = usePage().props as any;
  const isChefChantier = page?.auth?.user?.role === UserRole.ChefChantier.value;
  const canManageChefTeam = !isChefChantier;
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<UserRoleValue | 'all'>('all');
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserItem | null>(null);
  const [teamWorkerIds, setTeamWorkerIds] = React.useState<number[]>([]);

  const [chefTeamModalOpen, setChefTeamModalOpen] = React.useState(false);
  const [selectedChef, setSelectedChef] = React.useState<UserItem | null>(null);
  const [chefTeamWorkerIds, setChefTeamWorkerIds] = React.useState<number[]>([]);

  // Team management modal state (ingénieur — existant)
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);
  const [selectedEngineer, setSelectedEngineer] = React.useState<UserItem | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<number[]>([]);
  const [formData, setFormData] = React.useState<{
    name: string;
    email: string;
    password: string;
    role: UserRoleValue;
    phone: string;
    skills: string;
    engineer_id: string;
    chef_chantier_id: string;
  }>({
    name: '',
    email: '',
    password: '',
    role: UserRole.Worker.value,
    phone: '',
    skills: '',
    engineer_id: '',
    chef_chantier_id: '',
  });

  const workforce = React.useMemo<WorkforceRow[]>(() => {
    return users.map((user) => {
      const baseSalary = BASE_SALARY_BY_ROLE[user.role] ?? 850;
      const skillsList = user.skills 
        ? user.skills.split(',').map(s => s.trim()) 
        : (SKILLS_BY_ROLE[user.role] ?? ['Polyvalent']);

      return {
        ...user,
        roleLabel: ROLE_LABELS[user.role] ?? user.role,
        phone: formatPhone(user.id),
        salary: baseSalary,
        status: user.status as any,
        skillsList,
      };
    });
  }, [users]);

  const filteredWorkforce = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return workforce.filter((row) => {
      // Filter by role
      if (selectedRole !== 'all' && row.role !== selectedRole) {
        return false;
      }

      // Filter by search term
      if (!term) {
        return true;
      }

      const haystack = `${row.name} ${row.email} ${row.roleLabel} ${row.phone} ${row.skillsList.join(' ')}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [workforce, searchTerm, selectedRole]);

  const stats = React.useMemo(() => {
    const active = workforce.filter((row) => row.status === 'Actif').length;
    const onLeave = workforce.filter((row) => row.status === 'Congé').length;

    return {
      total: workforce.length,
      active,
      onLeave,
    };
  }, [workforce]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'role' && value !== UserRole.ChefChantier.value) {
        setTeamWorkerIds([]);
      }
      if (name === 'role' && value === UserRole.ChefChantier.value && engineers.length === 1) {
        next.engineer_id = String(engineers[0].id);
      }

      return next;
    });
  };

  const toggleTeamWorker = (workerId: number) => {
    setTeamWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId],
    );
  };

  const toggleChefModalWorker = (workerId: number) => {
    setChefTeamWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId],
    );
  };

  React.useEffect(() => {
    if (formData.role === UserRole.ChefChantier.value && engineers.length === 1 && !formData.engineer_id) {
      setFormData((prev) => ({ ...prev, engineer_id: String(engineers[0].id) }));
    }
  }, [formData.role, formData.engineer_id, engineers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const url = editingUser ? update.url({ user: editingUser.id }) : store.url();
    const method = editingUser ? 'put' : 'post';

    const payload: Record<string, unknown> = { ...formData };
    if (formData.role === UserRole.ChefChantier.value) {
      payload.team_worker_ids = teamWorkerIds;
    } else {
      delete payload.team_worker_ids;
    }

    router.visit(url, {
      method,
      data: payload,
      onSuccess: () => {
        setFormData({
          name: '',
          email: '',
          password: '',
          role: UserRole.Worker.value,
          phone: '',
          skills: '',
          engineer_id: '',
          chef_chantier_id: '',
        });
        setTeamWorkerIds([]);
        setEditingUser(null);
        setOpen(false);
      },
      onError: () => {
        alert('Erreur lors de l\'enregistrement');
      },
      onFinish: () => {
        setIsLoading(false);
      },
    });
  };

  const handleEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Leave empty for updates
      role: user.role,
      phone: user.phone || '',
      skills: user.skills || '',
      engineer_id: user.engineer_id ? user.engineer_id.toString() : '',
      chef_chantier_id: user.chef_chantier_id ? user.chef_chantier_id.toString() : '',
    });
    if (user.role === UserRole.ChefChantier.value) {
      setTeamWorkerIds(
        users.filter((u) => u.role === UserRole.Worker.value && u.chef_chantier_id === user.id).map((u) => u.id),
      );
    } else {
      setTeamWorkerIds([]);
    }
    setOpen(true);
  };

  const openChefTeamModal = (chef: UserItem) => {
    setSelectedChef(chef);
    setChefTeamWorkerIds(
      users.filter((u) => u.role === UserRole.Worker.value && u.chef_chantier_id === chef.id).map((u) => u.id),
    );
    setChefTeamModalOpen(true);
  };

  const saveChefTeam = () => {
    if (!selectedChef) {
      return;
    }

    setIsLoading(true);
    router.put(
      update.url({ user: selectedChef.id }),
      {
        name: selectedChef.name,
        email: selectedChef.email,
        role: selectedChef.role,
        phone: selectedChef.phone ?? '',
        skills: selectedChef.skills ?? '',
        engineer_id: selectedChef.engineer_id ? String(selectedChef.engineer_id) : '',
        chef_chantier_id: '',
        team_worker_ids: chefTeamWorkerIds,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setChefTeamModalOpen(false);
          setSelectedChef(null);
          setChefTeamWorkerIds([]);
        },
        onError: () => {
          alert('Erreur lors de la mise à jour de l\'équipe');
        },
        onFinish: () => {
          setIsLoading(false);
        },
      },
    );
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    router.delete(destroy.url({ user: userId }), {
      onError: () => {
        alert('Erreur lors de la suppression');
      },
    });
  };

  // Open team management modal for an engineer
  const openTeamModal = (engineer: UserItem) => {
    setSelectedEngineer(engineer);
    // Get current team members (workers assigned to this engineer)
    const currentTeamIds = users
      .filter(u => u.engineer_id === engineer.id && u.role === UserRole.Worker.value)
      .map(u => u.id);
    setSelectedTeamIds(currentTeamIds);
    setTeamModalOpen(true);
  };

  // Toggle worker selection in team
  const toggleWorkerSelection = (workerId: number) => {
    setSelectedTeamIds(prev => 
      prev.includes(workerId) 
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  // Save team assignments
  const saveTeamAssignments = () => {
    if (!selectedEngineer) return;
    
    setIsLoading(true);
    
    // Update all selected workers to have this engineer_id
    const promises = selectedTeamIds.map(workerId => {
      const worker = users.find(u => u.id === workerId);
      if (worker) {
        return router.put(update.url({ user: workerId }), {
          ...worker,
          engineer_id: selectedEngineer.id.toString()
        }, { preserveScroll: true });
      }
      return Promise.resolve();
    });

    // Remove engineer_id from workers that were deselected
    const currentTeamIds = users
      .filter(u => u.engineer_id === selectedEngineer.id && u.role === UserRole.Worker.value)
      .map(u => u.id);
    
    const removedIds = currentTeamIds.filter(id => !selectedTeamIds.includes(id));
    
    const removePromises = removedIds.map(workerId => {
      const worker = users.find(u => u.id === workerId);
      if (worker) {
        return router.put(update.url({ user: workerId }), {
          ...worker,
          engineer_id: ''
        }, { preserveScroll: true });
      }
      return Promise.resolve();
    });

    Promise.all([...promises, ...removePromises]).then(() => {
      setTeamModalOpen(false);
      setSelectedEngineer(null);
      setSelectedTeamIds([]);
      setIsLoading(false);
      router.reload();
    }).catch(() => {
      setIsLoading(false);
      alert('Erreur lors de la mise à jour de l\'équipe');
    });
  };

  return (
    <>
      <Head title="Main-d'oeuvre" />

      <div className="space-y-6">
        <div className="flex flex-row items-center justify-between pb-2">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">Main-d'œuvre</h1>
              <p className="mt-1 text-slate-500 font-medium">Gestion des ouvriers et du personnel</p>
            </div>

            <div className="flex items-center gap-2">
            </div>

            {!isChefChantier && (
              <Dialog
                open={open}
                onOpenChange={(next) => {
                  setOpen(next);
                  if (!next) {
                    setEditingUser(null);
                    setTeamWorkerIds([]);
                  }
                }}
              >
              <DialogTrigger asChild>
                <Button className="h-12 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Ajouter ouvrier
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogTitle>{editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un membre de l\'équipe'}</DialogTitle>

                <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <Label htmlFor="name">Nom complet *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Ex: Jean Mulumba"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="jean@chantier.cd"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Mot de passe {editingUser ? '(Laisser vide pour ne pas changer)' : '*'}</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimum 8 caractères"
                      required={!editingUser}
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Fonction *</Label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      required
                    >
                      <option value={UserRole.Worker.value}>Ouvrier</option>
                      <option value={UserRole.ChefChantier.value}>Chef chantier</option>
                      <option value={UserRole.Engineer.value}>Ingénieur</option>
                      <option value={UserRole.Magasinier.value}>Magasinier</option>
                      <option value={UserRole.Manager.value}>Directeur</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="phone">Numéro de téléphone *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Ex: 50"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="skills">Compétences (séparées par des virgules)</Label>
                    <Input
                      id="skills"
                      name="skills"
                      value={formData.skills}
                      onChange={handleChange}
                      placeholder="Ex: Maçonnerie, Plomberie"
                    />
                  </div>

                  {formData.role === UserRole.ChefChantier.value && (
                    <div>
                      <Label htmlFor="engineer_id">Ingénieur responsable *</Label>
                      <select
                        id="engineer_id"
                        name="engineer_id"
                        value={formData.engineer_id}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        required
                      >
                        <option value="">-- Sélectionner --</option>
                        {engineers.map((engineer) => (
                          <option key={engineer.id} value={engineer.id.toString()}>
                            {engineer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.role === UserRole.Magasinier.value && (
                    <div>
                      <Label htmlFor="engineer_id_mag">Ingénieur responsable (optionnel)</Label>
                      <select
                        id="engineer_id_mag"
                        name="engineer_id"
                        value={formData.engineer_id}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="">-- Aucun --</option>
                        {engineers.map((engineer) => (
                          <option key={engineer.id} value={engineer.id.toString()}>
                            {engineer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.role === UserRole.Worker.value && (
                    <div>
                      <Label htmlFor="chef_chantier_id_worker">Chef de chantier *</Label>
                      <select
                        id="chef_chantier_id_worker"
                        name="chef_chantier_id"
                        value={formData.chef_chantier_id}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        required
                      >
                        <option value="">-- Sélectionner un chef --</option>
                        {chefChantiers.map((chef) => (
                          <option key={chef.id} value={chef.id.toString()}>
                            {chef.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.role === UserRole.ChefChantier.value && assignableWorkers.length > 0 && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                      <Label className="text-indigo-900">Équipe d&apos;ouvriers (optionnel)</Label>
                      <p className="mb-2 text-xs text-indigo-700">
                        Cochez les ouvriers à rattacher à ce chef. Vous pourrez modifier cette liste plus tard via « Équipe ».
                      </p>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {assignableWorkers.map((w) => {
                          const onOtherChef =
                            w.chef_chantier_id != null &&
                            (!editingUser || w.chef_chantier_id !== editingUser.id);
                          const checked = teamWorkerIds.includes(w.id);

                          return (
                            <label
                              key={w.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                                checked ? 'border-indigo-400 bg-white' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTeamWorker(w.id)}
                                className="rounded border-slate-300"
                              />
                              <span className="font-medium text-slate-800">{w.name}</span>
                              {onOtherChef && (
                                <span className="text-[10px] font-bold uppercase text-amber-700">
                                  (autre équipe)
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formData.role === UserRole.Engineer.value && (
                    <div>
                      <Label htmlFor="chef_chantier_id">Chef de chantier (Responsable)</Label>
                      <select
                        id="chef_chantier_id"
                        name="chef_chantier_id"
                        value={formData.chef_chantier_id}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="">-- Aucun --</option>
                        {chefChantiers.map((chef) => (
                          <option key={chef.id} value={chef.id.toString()}>
                            {chef.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(null);
                          setTeamWorkerIds([]);
                          setFormData({
                            name: '',
                            email: '',
                            password: '',
                            role: UserRole.Worker.value,
                            phone: '',
                            skills: '',
                            engineer_id: '',
                            chef_chantier_id: '',
                          });
                        }}
                      >
                        Annuler
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading}>{isLoading ? 'Enregistrement...' : (editingUser ? 'Modifier' : 'Créer')}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-blue-500 p-6 text-white shadow-xl shadow-blue-500/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-sm font-black uppercase tracking-wider">Total ouvriers</p>
                    <Users className="h-6 w-6" />
                </div>
                <p className="text-5xl font-black">{stats.total}</p>
              </div>
              <div className="rounded-3xl bg-emerald-500 p-6 text-white shadow-xl shadow-emerald-500/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-sm font-black uppercase tracking-wider">Actifs</p>
                    <TrendingUp className="h-6 w-6" />
                </div>
                <p className="text-5xl font-black">{stats.active}</p>
              </div>
              <div className="rounded-3xl bg-orange-500 p-6 text-white shadow-xl shadow-orange-500/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-sm font-black uppercase tracking-wider">En congé</p>
                    <ActivityIcon className="h-6 w-6" />
                </div>
                <p className="text-5xl font-black">{stats.onLeave}</p>
              </div>
        </div>

        {/* Filtres par rôle */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedRole('all')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedRole === 'all'
                ? 'bg-slate-800 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setSelectedRole(UserRole.Worker.value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedRole === UserRole.Worker.value
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50'
            }`}
          >
            Ouvriers
          </button>
          <button
            onClick={() => setSelectedRole(UserRole.Engineer.value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedRole === UserRole.Engineer.value
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-purple-50'
            }`}
          >
            Ingénieurs
          </button>
          <button
            onClick={() => setSelectedRole(UserRole.ChefChantier.value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedRole === UserRole.ChefChantier.value
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50'
            }`}
          >
            Chefs de chantier
          </button>
          <button
            onClick={() => setSelectedRole(UserRole.Magasinier.value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedRole === UserRole.Magasinier.value
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50'
            }`}
          >
            Magasiniers
          </button>
          <button
            onClick={() => setSelectedRole(UserRole.Manager.value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedRole === UserRole.Manager.value
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Directeurs
          </button>
        </div>

        <div className="relative group">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher un ouvrier..."
              className="h-14 w-full rounded-2xl border-slate-200 bg-white pl-12 text-lg shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
        </div>

        <Card className="rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/50 text-left">
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Nom</th>
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Rôle</th>
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Téléphone</th>
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Statut</th>
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Équipe / Responsable</th>
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Compétences</th>
                  <th className="px-6 py-5 text-right font-black uppercase tracking-wider text-slate-400 text-[10px]">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredWorkforce.length > 0 ? (
                  filteredWorkforce.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-blue-50/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                <AvatarFallback className={`${
                                    row.id % 4 === 0 ? 'bg-blue-500' :
                                    row.id % 4 === 1 ? 'bg-emerald-500' :
                                    row.id % 4 === 2 ? 'bg-orange-500' : 'bg-purple-500'
                                } text-white font-bold`}>
                                    {row.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-slate-900">{row.name}</p>
                                <p className="text-[11px] font-medium text-slate-400">Depuis 2025-01-15</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{row.roleLabel}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{row.phone}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-tight ${
                            row.status === 'Actif'
                              ? 'bg-emerald-100 text-emerald-700'
                              : row.status === 'Congé'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {row.role === UserRole.ChefChantier.value ? (
                          <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600 border border-indigo-100">
                            Sous {row.engineer?.name ?? '—'}
                          </span>
                        ) : row.role === UserRole.Engineer.value ? (
                          <span className="text-[11px] font-medium text-slate-600">
                            {row.chefChantier ? `Sous ${row.chefChantier.name}` : 'Indépendant'}
                          </span>
                        ) : row.role === UserRole.Worker.value && row.chefChantier ? (
                          <span className="text-[11px] font-medium text-slate-600">
                            Chef : {row.chefChantier.name}
                          </span>
                        ) : row.engineer ? (
                          <span className="text-[11px] font-medium text-slate-600">
                            Équipe {row.engineer.name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {row.skillsList.map((skill) => (
                            <span key={skill} className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase border border-blue-100">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {row.role === UserRole.Engineer.value && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTeamModal(row)}
                              className="h-9 rounded-xl text-purple-600 hover:text-purple-700 hover:bg-purple-50 font-bold text-xs"
                            >
                              <UsersRound className="h-4 w-4 mr-1" />
                              Équipe
                            </Button>
                          )}
                          {canManageChefTeam && row.role === UserRole.ChefChantier.value && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openChefTeamModal(row)}
                              className="h-9 rounded-xl text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold text-xs"
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Équipe
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(row)}
                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(row.id)}
                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Aucune correspondance trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Équipe ouvriers — chef de chantier */}
        <Dialog open={chefTeamModalOpen} onOpenChange={setChefTeamModalOpen}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
            <DialogTitle className="text-xl font-black">
              Équipe de {selectedChef?.name}
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-500">
              Sélectionnez les ouvriers rattachés à ce chef de chantier.
            </p>

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-2">
              {assignableWorkers.length === 0 ? (
                <p className="py-4 text-center text-slate-400">Aucun ouvrier disponible pour l&apos;affectation.</p>
              ) : (
                assignableWorkers.map((worker) => {
                  const selected = chefTeamWorkerIds.includes(worker.id);
                  const otherChef =
                    worker.chef_chantier_id != null &&
                    (!selectedChef || worker.chef_chantier_id !== selectedChef.id);

                  return (
                    <label
                      key={worker.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                        selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected}
                        onChange={() => toggleChefModalWorker(worker.id)}
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{worker.name}</div>
                        {otherChef && (
                          <div className="text-xs text-amber-700">Déjà affecté à un autre chef (sera réaffecté)</div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setChefTeamModalOpen(false);
                  setSelectedChef(null);
                  setChefTeamWorkerIds([]);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={saveChefTeam}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isLoading ? 'Sauvegarde...' : `Enregistrer (${chefTeamWorkerIds.length})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Team Management Modal */}
        <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogTitle className="text-xl font-black">
              Gérer l'équipe de {selectedEngineer?.name}
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              Sélectionnez les ouvriers à assigner à cet ingénieur
            </p>

            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-2">
              {users.filter(u => u.role === UserRole.Worker.value).length === 0 ? (
                <p className="text-center text-slate-400 py-4">Aucun ouvrier disponible</p>
              ) : (
                users
                  .filter(u => u.role === UserRole.Worker.value)
                  .map(worker => {
                    const isSelected = selectedTeamIds.includes(worker.id);
                    const isAssignedToOther = worker.engineer_id && worker.engineer_id !== selectedEngineer?.id;

                    return (
                      <label
                        key={worker.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : isAssignedToOther
                            ? 'border-slate-200 bg-slate-100 opacity-60'
                            : 'border-slate-200 bg-white hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={() => toggleWorkerSelection(worker.id)}
                          disabled={isAssignedToOther}
                        />
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-800">{worker.name}</div>
                          <div className="text-xs text-slate-500">
                            {isAssignedToOther
                              ? `Assigné à ${users.find(u => u.id === worker.engineer_id)?.name || 'un autre ingénieur'}`
                              : worker.skills || 'Polyvalent'}
                          </div>
                        </div>
                      </label>
                    );
                  })
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setTeamModalOpen(false);
                  setSelectedEngineer(null);
                  setSelectedTeamIds([]);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={saveTeamAssignments}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? 'Sauvegarde...' : `Sauvegarder (${selectedTeamIds.length})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
