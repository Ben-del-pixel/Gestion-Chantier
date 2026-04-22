import { Head, router } from '@inertiajs/react';
import { Pencil, Search, Trash2, UserPlus, Users, TrendingUp, History as ActivityIcon, Coins } from 'lucide-react';
import React from 'react';

import { destroy, index, store, update } from '@/actions/App/Http/Controllers/UserController';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserRole, UserRoleValue } from '@/Enums/UserRole';

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: UserRoleValue;
  daily_rate: string | number | null;
  skills: string | null;
  status: 'Actif' | 'Inactif';
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

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

export default function UsersIndex({ users }: { users: UserItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserItem | null>(null);
  const [formData, setFormData] = React.useState<{
    name: string;
    email: string;
    password: string;
    role: UserRoleValue;
    daily_rate: string;
    skills: string;
  }>({
    name: '',
    email: '',
    password: '',
    role: UserRole.Worker.value,
    daily_rate: '',
    skills: '',
  });

  const workforce = React.useMemo<WorkforceRow[]>(() => {
    return users.map((user) => {
      const baseSalary = user.daily_rate ? Number(user.daily_rate) : (BASE_SALARY_BY_ROLE[user.role] ?? 850);
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

    if (!term) {
      return workforce;
    }

    return workforce.filter((row) => {
      const haystack = `${row.name} ${row.email} ${row.roleLabel} ${row.phone} ${row.skillsList.join(' ')}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [workforce, searchTerm]);

  const stats = React.useMemo(() => {
    const active = workforce.filter((row) => row.status === 'Actif').length;
    const onLeave = workforce.filter((row) => row.status === 'Congé').length;
    const payroll = workforce.reduce((sum, row) => sum + row.salary, 0);

    return {
      total: workforce.length,
      active,
      onLeave,
      payroll,
    };
  }, [workforce]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = editingUser ? update.url({ user: editingUser.id }) : store.url();
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error:', error);
        alert('Erreur lors de l\'enregistrement');

        return;
      }

      setFormData({ name: '', email: '', password: '', role: UserRole.Worker.value, daily_rate: '', skills: '' });
      setEditingUser(null);
      setOpen(false);
      router.visit(index.url());
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Leave empty for updates
      role: user.role,
      daily_rate: user.daily_rate?.toString() || '',
      skills: user.skills || '',
    });
    setOpen(true);
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      const response = await fetch(destroy.url({ user: userId }), {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
      });

      if (!response.ok) {
        alert('Erreur lors de la suppression');

        return;
      }

      router.visit(index.url());
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la suppression');
    }
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

            <Dialog open={open} onOpenChange={setOpen}>
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
                    <Label htmlFor="daily_rate">Montant journalier (USD) *</Label>
                    <Input
                      id="daily_rate"
                      name="daily_rate"
                      type="number"
                      value={formData.daily_rate}
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

                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" onClick={() => { setEditingUser(null); setFormData({ name: '', email: '', password: '', role: UserRole.Worker.value, daily_rate: '', skills: '' }); }}>Annuler</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading}>{isLoading ? 'Enregistrement...' : (editingUser ? 'Modifier' : 'Créer')}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
              <div className="rounded-3xl bg-purple-600 p-6 text-white shadow-xl shadow-purple-600/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-sm font-black uppercase tracking-wider">Masse salariale</p>
                    <Coins className="h-6 w-6" />
                </div>
                <p className="text-5xl font-black">{stats.payroll}<span className="text-2xl ml-1">$</span></p>
              </div>
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
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Salaire</th>
                  <th className="px-6 py-5 font-black uppercase tracking-wider text-slate-400 text-[10px]">Statut</th>
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
                      <td className="px-6 py-4 font-bold text-slate-900">{row.salary}<span className="text-slate-400">$/mois</span></td>
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
      </div>
    </>
  );
}
