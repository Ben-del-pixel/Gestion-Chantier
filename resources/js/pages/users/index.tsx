import { Head, router } from '@inertiajs/react';
import { Search, Trash2, UserPlus } from 'lucide-react';
import React from 'react';

import { destroy, index, store } from '@/actions/App/Http/Controllers/UserController';
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
import { UserRole } from '@/Enums/UserRole';

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: string;
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
  const [formData, setFormData] = React.useState({
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
        console.error('Error:', error);
        alert('Erreur lors de la création de l\'utilisateur');

        return;
      }

      setFormData({ name: '', email: '', password: '', role: UserRole.Worker.value, daily_rate: '', skills: '' });
      setOpen(false);
      router.visit(index.url());
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la création de l\'utilisateur');
    } finally {
      setIsLoading(false);
    }
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

      <div className="space-y-5">
        <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <h1 className="text-[40px] font-semibold tracking-tight text-slate-900">Gestion de la Main-d'oeuvre</h1>
              <p className="text-lg text-slate-500">Suivi des effectifs et des compétences terrain</p>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ajouter ouvrier
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogTitle>Ajouter un membre de l'équipe</DialogTitle>

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
                    <Label htmlFor="password">Mot de passe *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimum 8 caractères"
                      required
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
                      <Button type="button" variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading}>{isLoading ? 'Création...' : 'Créer'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-blue-100/70 px-4 py-3">
                <p className="text-sm font-medium text-blue-700">Total Ouvriers</p>
                <p className="mt-1 text-4xl font-semibold text-blue-700">{stats.total}</p>
              </div>
              <div className="rounded-xl bg-emerald-100/70 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700">Actifs</p>
                <p className="mt-1 text-4xl font-semibold text-emerald-700">{stats.active}</p>
              </div>
              <div className="rounded-xl bg-amber-100/70 px-4 py-3">
                <p className="text-sm font-medium text-amber-700">En congé</p>
                <p className="mt-1 text-4xl font-semibold text-amber-700">{stats.onLeave}</p>
              </div>
              <div className="rounded-xl bg-violet-100/70 px-4 py-3">
                <p className="text-sm font-medium text-violet-700">Masse salariale</p>
                <p className="mt-1 text-4xl font-semibold text-violet-700">{formatCurrency(stats.payroll)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
          <CardContent className="py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Rechercher par nom, fonction, compétence..."
                className="h-11 rounded-xl border-slate-300 bg-white pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">Liste de l'équipe ({filteredWorkforce.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead>
                <tr className="border-b bg-slate-100/70 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Nom</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Fonction</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Téléphone</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Salaire</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Statut</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Compétences</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredWorkforce.length > 0 ? (
                  filteredWorkforce.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.roleLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{row.phone}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{formatCurrency(row.salary)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.status === 'Actif'
                              ? 'bg-emerald-100 text-emerald-700'
                              : row.status === 'Congé'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.skillsList.map((skill) => (
                            <span key={skill} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(row.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
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
