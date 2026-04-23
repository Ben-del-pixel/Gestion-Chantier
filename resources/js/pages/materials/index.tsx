import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Package, Pencil, Plus, Search, Trash2, ClipboardCheck, TrendingUp, Coins, LayoutGrid, List, Link as LinkIcon } from 'lucide-react';
import React from 'react';

import { allocate, destroy, store, update } from '@/actions/App/Http/Controllers/Api/MaterialController';
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
import { Badge } from '@/components/ui/badge';

type MaterialItem = {
    id: number;
    name: string;
    description: string | null;
    quantity_in_stock: number | string;
    unit: string;
    category: string | null;
    updated_at: string;
};

type ProjectItem = {
    id: number;
    name: string;
};

type ProjectAllocation = {
    project_id: number;
    project_name: string;
    materials: {
        name: string;
        quantity: number;
        unit: string;
    }[];
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

export default function MaterialsIndex({ 
    materials, 
    projectAllocations = [],
    projects = [],
}: { 
    materials: MaterialItem[]; 
    projectAllocations?: ProjectAllocation[];
    projects?: ProjectItem[];
}) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [openDialog, setOpenDialog] = React.useState(false);
    const [openAllocationDialog, setOpenAllocationDialog] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [editingMaterial, setEditingMaterial] = React.useState<MaterialItem | null>(null);
    const [selectedMaterialForAllocation, setSelectedMaterialForAllocation] = React.useState<MaterialItem | null>(null);
    const [activeTab, setActiveTab] = React.useState('stock');
    const [formData, setFormData] = React.useState({
        name: '',
        description: '',
        quantity_in_stock: '',
        unit: 'sacs',
        category: '',
    });
    const [allocationFormData, setAllocationFormData] = React.useState({
        material_id: '',
        project_id: '',
        quantity_requested: '',
        comment: '',
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

    const handleAllocationFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setAllocationFormData({
            ...allocationFormData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmitMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const url = editingMaterial ? update.url({ material: editingMaterial.id }) : store.url();
            const method = editingMaterial ? 'put' : 'post';

            router.visit(url, {
                method,
                data: formData,
                onSuccess: () => {
                    setFormData({ name: '', description: '', quantity_in_stock: '', unit: 'sacs', category: '' });
                    setEditingMaterial(null);
                    setOpenDialog(false);
                },
                onError: () => {
                    alert('Erreur lors de l\'enregistrement du matériau');
                },
                onFinish: () => {
                    setIsSubmitting(false);
                },
            });
        } catch (error) {
            console.error('Error:', error);
            alert('Erreur lors de l\'enregistrement du matériau');
            setIsSubmitting(false);
        }
    };

    const handleEdit = (material: MaterialItem) => {
        setEditingMaterial(material);
        setFormData({
            name: material.name,
            description: material.description || '',
            quantity_in_stock: material.quantity_in_stock.toString(),
            unit: material.unit,
            category: material.category || '',
        });
        setOpenDialog(true);
    };

    const handleDelete = (id: number) => {
        if (!window.confirm('Supprimer ce matériau ?')) return;

        router.delete(destroy.url({ material: id }), {
            onSuccess: () => {
                // Page will be refreshed automatically by Inertia
            },
            onError: () => {
                alert('Erreur lors de la suppression');
            },
        });
    };

    const handleOpenAllocationDialog = (material: MaterialItem) => {
        setSelectedMaterialForAllocation(material);
        setAllocationFormData({
            material_id: material.id.toString(),
            project_id: '',
            quantity_requested: '',
            comment: '',
        });
        setOpenAllocationDialog(true);
    };

    const handleSubmitAllocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const data = {
            material_id: parseInt(allocationFormData.material_id),
            project_id: parseInt(allocationFormData.project_id),
            quantity_requested: parseFloat(allocationFormData.quantity_requested),
            comment: allocationFormData.comment || null,
        };

        router.visit(allocate.url(), {
            method: 'post',
            data,
            onSuccess: () => {
                setAllocationFormData({ material_id: '', project_id: '', quantity_requested: '', comment: '' });
                setSelectedMaterialForAllocation(null);
                setOpenAllocationDialog(false);
            },
            onError: () => {
                alert('Erreur lors de l\'affectation du matériau');
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    return (
        <>
            <Head title="Matériaux" />

      <div className="space-y-6">
        <div className="flex flex-row items-center justify-between pb-2">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">Magasin & Stock</h1>
              <p className="mt-1 text-slate-500 font-medium">Gestion des matériaux et inventaire Lubumbashi</p>
            </div>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button className="h-12 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
                  <Plus className="mr-2 h-5 w-5" />
                  Nouveau Matériau
                </Button>
              </DialogTrigger>

                        <DialogContent>
                            <DialogTitle>{editingMaterial ? 'Modifier le matériau' : 'Ajouter un matériau'}</DialogTitle>

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
                                        <Button type="button" variant="outline" onClick={() => { setEditingMaterial(null); setFormData({ name: '', description: '', quantity_in_stock: '', unit: 'sacs', category: '' }); }}>Annuler</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enregistrement...' : (editingMaterial ? 'Modifier' : 'Créer')}</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={openAllocationDialog} onOpenChange={setOpenAllocationDialog}>
                        <DialogContent>
                            <DialogTitle>Affecter un matériau à un chantier</DialogTitle>

                            <form className="mt-4 space-y-4" onSubmit={handleSubmitAllocation}>
                                <div>
                                    <Label htmlFor="material-allocation">Matériau</Label>
                                    <Input
                                        id="material-allocation"
                                        type="text"
                                        value={selectedMaterialForAllocation?.name || ''}
                                        disabled
                                        className="bg-slate-100 text-slate-600"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="project">Chantier/Projet *</Label>
                                    <select
                                        id="project"
                                        name="project_id"
                                        value={allocationFormData.project_id}
                                        onChange={handleAllocationFormChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        required
                                    >
                                        <option value="">-- Sélectionner un chantier --</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id.toString()}>
                                                {project.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <Label htmlFor="quantity">Quantité à affecter *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="quantity"
                                            name="quantity_requested"
                                            type="number"
                                            value={allocationFormData.quantity_requested}
                                            onChange={handleAllocationFormChange}
                                            placeholder="0"
                                            required
                                            step="0.01"
                                            min="0.01"
                                            className="flex-1"
                                        />
                                        <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 flex items-center whitespace-nowrap">
                                            {selectedMaterialForAllocation?.unit}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="comment">Commentaire (optionnel)</Label>
                                    <textarea
                                        id="comment"
                                        name="comment"
                                        value={allocationFormData.comment}
                                        onChange={handleAllocationFormChange}
                                        placeholder="Ex: Livraison le 25/04, sur site A..."
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" onClick={() => {
                                            setSelectedMaterialForAllocation(null);
                                            setAllocationFormData({ material_id: '', project_id: '', quantity_requested: '', comment: '' });
                                        }}>Annuler</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                                        {isSubmitting ? 'Affectation en cours...' : 'Affecter le matériau'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

        {/* Premium Stats Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-blue-500 p-6 text-white shadow-xl shadow-blue-500/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-wider">Total Articles</p>
                    <Package className="h-6 w-6" />
                </div>
                <p className="text-4xl font-black">{normalizedMaterials.length}</p>
              </div>
              <div className="rounded-3xl bg-emerald-500 p-6 text-white shadow-xl shadow-emerald-500/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-wider">Valeur Stock</p>
                    <Coins className="h-6 w-6" />
                </div>
                <p className="text-3xl font-black">{formatAmount(normalizedMaterials.reduce((acc, m) => acc + m.total, 0))}</p>
              </div>
              <div className="rounded-3xl bg-amber-500 p-6 text-white shadow-xl shadow-amber-500/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-wider">Alertes Stock</p>
                    <AlertTriangle className="h-6 w-6" />
                </div>
                <p className="text-4xl font-black">{normalizedMaterials.filter(m => m.lowStock).length}</p>
              </div>
              <div className="rounded-3xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20 group transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between opacity-80 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-wider">Affectations</p>
                    <TrendingUp className="h-6 w-6" />
                </div>
                <p className="text-4xl font-black">{projectAllocations.length}</p>
              </div>
        </div>

        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex rounded-2xl bg-slate-100 p-1.5 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('stock')}
                        className={`rounded-xl px-8 py-3 font-bold transition-all ${activeTab === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutGrid className="mr-2 h-4 w-4 inline-block" />
                        Inventaire Stock
                    </button>
                    <button 
                        onClick={() => setActiveTab('allocations')}
                        className={`rounded-xl px-8 py-3 font-bold transition-all ${activeTab === 'allocations' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <TrendingUp className="mr-2 h-4 w-4 inline-block" />
                        Affectations Chantiers
                    </button>
                </div>

                <div className="relative group w-full max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Rechercher un matériau..."
                        className="h-14 w-full rounded-2xl border-slate-200 bg-white pl-12 text-lg shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                    />
                </div>
            </div>

            {activeTab === 'stock' && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredMaterials.length > 0 ? filteredMaterials.map((material) => (
                        <Card key={material.id} className="group relative rounded-[32px] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40 transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden">
                            <CardHeader className="space-y-4 p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                                        <Package className="h-6 w-6" />
                                    </div>
                                    <Badge className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${material.lowStock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {material.lowStock ? 'Alerte Stock' : 'Disponible'}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl font-black leading-tight text-slate-900">{material.name}</CardTitle>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{material.supplier}</p>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6 p-6 pt-0">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-center">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Quantité</p>
                                        <p className="text-xl font-black text-slate-900">{formatQuantity(material.quantity, material.unit)}</p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-center">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Stock Valeur</p>
                                        <p className="text-xl font-black text-blue-600 tracking-tighter">{formatAmount(material.total)}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Button onClick={() => handleOpenAllocationDialog(material)} className="h-11 w-full rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all">
                                        <LinkIcon className="mr-2 h-4 w-4" />
                                        Affecter au Chantier
                                    </Button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button onClick={() => handleEdit(material)} variant="outline" className="h-11 rounded-xl border-blue-100 bg-blue-50/50 font-bold text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Modifier
                                        </Button>
                                        <Button
                                            onClick={() => handleDelete(material.id)}
                                            variant="outline"
                                            className="h-11 rounded-xl border-rose-100 bg-rose-50/50 font-bold text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="col-span-full py-20 text-center">
                            <p className="text-xl font-black text-slate-900">Aucun matériau trouvé</p>
                            <p className="text-slate-500 font-medium">Réinitialisez les filtres pour voir tout le stock.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'allocations' && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projectAllocations.length > 0 ? projectAllocations.map((allocation) => (
                        <Card key={allocation.project_id} className="group relative rounded-[32px] border border-blue-100 bg-blue-50/30 p-2 shadow-xl shadow-blue-500/5 transition-all hover:shadow-2xl hover:shadow-blue-500/10">
                            <CardHeader className="pb-4 p-6 pt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Affectation Chantier</p>
                                </div>
                                <CardTitle className="text-2xl font-black text-blue-900 leading-tight">{allocation.project_name}</CardTitle>
                            </CardHeader>
                            <CardContent className="px-6 pb-6">
                                <div className="space-y-3">
                                    {allocation.materials.map((m, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-blue-100/50 shadow-sm transition-transform hover:scale-[1.02]">
                                            <span className="font-bold text-slate-700">{m.name}</span>
                                            <span className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight">
                                                {m.quantity} {m.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="col-span-full py-20 text-center">
                            <p className="text-xl font-black text-slate-900">Aucune affectation enregistrée</p>
                            <p className="text-slate-500 font-medium">Les matériaux livrés aux chantiers apparaîtront ici.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </>
  );
}
