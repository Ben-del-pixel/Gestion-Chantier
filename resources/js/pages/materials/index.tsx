import { Head } from '@inertiajs/react';
import { AlertTriangle, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import React from 'react';

import { store } from '@/actions/App/Http/Controllers/Api/MaterialController';
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

type MaterialItem = {
    id: number;
    name: string;
    description: string | null;
    quantity_in_stock: number | string;
    unit: string;
    category: string | null;
    updated_at: string;
};

const UNIT_PRICE_BY_NAME: Record<string, number> = {
    ciment: 15,
    acier: 800,
    briques: 120,
    bois: 450,
};

const SUPPLIER_BY_NAME: Record<string, string> = {
    ciment: 'Fournisseur A',
    acier: 'Fournisseur B',
    briques: 'Fournisseur C',
    bois: 'Fournisseur A',
};

const STOCK_THRESHOLD_BY_UNIT: Record<string, number> = {
    sacs: 120,
    tonnes: 80,
    milliers: 60,
    m3: 90,
    unite: 100,
    'unité': 100,
};

function normalizeKey(value: string): string {
    return value.trim().toLowerCase();
}

function formatAmount(amount: number): string {
    return `${Math.round(amount).toLocaleString('en-US')}$`;
}

function formatQuantity(quantity: number, unit: string): string {
    const rounded = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2);

    return `${rounded} ${unit}`;
}

function isLowStock(quantity: number, unit: string): boolean {
    const threshold = STOCK_THRESHOLD_BY_UNIT[normalizeKey(unit)] ?? 100;

    return quantity < threshold;
}

export default function MaterialsIndex({ materials }: { materials: MaterialItem[] }) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [openDialog, setOpenDialog] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: '',
        description: '',
        quantity_in_stock: '',
        unit: 'sacs',
        category: '',
    });

    const normalizedMaterials = React.useMemo(() => {
        return materials.map((material) => {
            const quantity = Number(material.quantity_in_stock || 0);
            const nameKey = normalizeKey(material.name);
            const unitPrice = UNIT_PRICE_BY_NAME[nameKey] ?? 100;
            const supplier = material.description || SUPPLIER_BY_NAME[nameKey] || 'Fournisseur A';
            const lowStock = isLowStock(quantity, material.unit);

            return {
                ...material,
                quantity,
                unitPrice,
                supplier,
                lowStock,
                total: quantity * unitPrice,
            };
        });
    }, [materials]);

    const filteredMaterials = React.useMemo(() => {
        const term = searchTerm.toLowerCase();

        return normalizedMaterials.filter((material) => {
            const text = `${material.name} ${material.supplier} ${material.category ?? ''}`.toLowerCase();

            return text.includes(term);
        });
    }, [normalizedMaterials, searchTerm]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmitMaterial = async (e: React.FormEvent) => {
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
                alert('Erreur : ' + (error.message || 'Impossible de créer le matériau'));
                return;
            }

            setFormData({ name: '', description: '', quantity_in_stock: '', unit: 'sacs', category: '' });
            setOpenDialog(false);
            window.location.reload();
        } catch (error) {
            console.error('Error:', error);
            alert('Erreur lors de la création du matériau');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Head title="Matériaux" />

            <div className="space-y-5">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-[40px] font-semibold tracking-tight text-slate-900">Matériaux</h1>
                        <p className="text-lg text-slate-500">Gestion du stock de matériaux de construction</p>
                    </div>

                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                        <DialogTrigger asChild>
                            <Button className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter matériau
                            </Button>
                        </DialogTrigger>

                        <DialogContent>
                            <DialogTitle>Ajouter un matériau</DialogTitle>

                            <form className="mt-4 space-y-4" onSubmit={handleSubmitMaterial}>
                                <div>
                                    <Label htmlFor="name">Nom du matériau *</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        placeholder="Ex: Ciment Portland"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="description">Fournisseur / Description</Label>
                                    <Input
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleFormChange}
                                        placeholder="Ex: Fournisseur A"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="quantity_in_stock">Quantité *</Label>
                                        <Input
                                            id="quantity_in_stock"
                                            name="quantity_in_stock"
                                            type="number"
                                            value={formData.quantity_in_stock}
                                            onChange={handleFormChange}
                                            placeholder="100"
                                            required
                                            step="0.01"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="unit">Unité *</Label>
                                        <select
                                            id="unit"
                                            name="unit"
                                            value={formData.unit}
                                            onChange={handleFormChange}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                            required
                                        >
                                            <option value="sacs">Sacs</option>
                                            <option value="tonnes">Tonnes</option>
                                            <option value="milliers">Milliers</option>
                                            <option value="m3">m³</option>
                                            <option value="unite">Unité</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="category">Catégorie</Label>
                                    <Input
                                        id="category"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleFormChange}
                                        placeholder="Ex: Cimenterie"
                                    />
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
                </div>

                <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
                    <CardContent className="py-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Rechercher un matériau..."
                                className="h-11 rounded-xl border-slate-300 bg-white pl-10"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {filteredMaterials.map((material) => (
                        <Card key={material.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                                            <Package className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-[30px] font-semibold tracking-tight text-slate-900">{material.name}</CardTitle>
                                            <p className="text-sm text-slate-500">{material.supplier}</p>
                                        </div>
                                    </div>

                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${material.lowStock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                                    >
                                        {material.lowStock ? 'Stock faible' : 'En stock'}
                                    </span>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-700">
                                    <span className="text-slate-500">Quantité:</span>
                                    <span className="font-semibold">{formatQuantity(material.quantity, material.unit)}</span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span className="text-slate-500">Prix unitaire:</span>
                                    <span className="font-semibold">{formatAmount(material.unitPrice)}</span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span className="text-slate-500">Total:</span>
                                    <span className="font-semibold text-blue-600">{formatAmount(material.total)}</span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span className="text-slate-500">Dernière MAJ:</span>
                                    <span className="text-slate-500">{new Date(material.updated_at).toISOString().slice(0, 10)}</span>
                                </div>

                                {material.lowStock && (
                                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        Réapprovisionnement recommandé
                                    </div>
                                )}

                                <div className="grid grid-cols-[1fr_auto] gap-2 pt-2">
                                    <Button type="button" variant="outline" className="h-10 rounded-xl border-slate-200 bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200">
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Modifier
                                    </Button>
                                    <Button type="button" variant="outline" className="h-10 rounded-xl border-rose-200 bg-rose-50 px-3 text-rose-600 hover:bg-rose-100">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                             </CardContent>
                         </Card>
                     ))}
                 </div>

                {filteredMaterials.length === 0 && (
                    <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 py-10 text-center shadow-sm">
                        <CardContent>
                            <p className="text-base font-medium text-slate-600">Aucun matériau trouvé</p>
                            <p className="text-sm text-slate-500">Ajuste la recherche pour voir les stocks.</p>
                        </CardContent>
                    </Card>
                )}
             </div>
         </>
     );
 }
