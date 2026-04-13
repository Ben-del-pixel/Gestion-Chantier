import React from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { index, store, destroy } from '@/actions/App/Http/Controllers/UserController';
import { router } from '@inertiajs/react';

export default function UsersIndex({ users, roles }: any) {
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'Engineer',
  });

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

      setFormData({ name: '', email: '', password: '', role: 'Engineer' });
      setOpen(false);
      router.visit('/users');
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la création de l\'utilisateur');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    try {
      const response = await fetch(`/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
      });

      if (!response.ok) {
        alert('Erreur lors de la suppression');

        return;
      }

      router.visit('/users');
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getRoleName = (roleValue: string) => {
    const roleMap: Record<string, string> = {
      'manager': 'Manager',
      'engineer': 'Ingénieur',
      'worker': 'Ouvrier',
      'magasinier': 'Magasinier',
      'chef-chantier': 'Chef Chantier',
    };
    return roleMap[roleValue.toLowerCase()] || roleValue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Créez et gérez les utilisateurs de votre système</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl shadow-sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Nouvel Utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
            <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Jean Dupont"
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
                  placeholder="jean@exemple.com"
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
                <Label htmlFor="role">Rôle *</Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                  required
                >
                  <option value="Manager">Manager</option>
                  <option value="Engineer">Ingénieur</option>
                  <option value="Worker">Ouvrier</option>
                  <option value="Magasinier">Magasinier</option>
                  <option value="ChefChantier">Chef Chantier</option>
                </select>
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
      </div>

      <Card className="shadow-none border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Liste des utilisateurs ({users.length})</CardTitle>
          <CardDescription>Tous les utilisateurs du système</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Nom</th>
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Email</th>
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Rôle</th>
                  <th className="px-6 py-3 font-semibold text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length > 0 ? (
                  users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium">{user.name}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {getRoleName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      Aucun utilisateur. Créez votre premier utilisateur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
