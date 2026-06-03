import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, ChevronRight, Package, Pencil, Plus, Search, Trash2, ClipboardCheck, TrendingUp, LayoutGrid, List, Wrench, ChevronDown, User } from 'lucide-react';
import React from 'react';

import { destroy, index as materialsIndex, returnMaterial, stockIn, stockOut, store, update } from '@/actions/App/Http/Controllers/Api/MaterialController';
import { index as projectsIndex } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

type MaterialItem = {
    id: number;
    name: string;
    description: string | null;
    quantity_in_stock: number;
    on_site_quantity: number;
    unit: string;
    type: 'materiel' | 'materiaux';
    category: string | null;
    project_id?: number | null;
    updated_at: string;
    allocations: {
        id: number;
        project_name: string;
        quantity: number;
    }[];
    project?: {
        id: number;
        name: string;
        storekeeper_id?: number;
        storekeeper?: {
            id: number;
            name: string;
        };
    };
};

type AllocationLine = {
    resource_request_id: number;
    material_id: number;
    name: string;
    quantity: number;
    unit: string;
    type: string;
};

type ProjectAllocationDetail = {
    project_id: number;
    project_name: string;
    materiaux: AllocationLine[];
    materiel: AllocationLine[];
};

type StorekeeperAllocationGroup = {
    storekeeper_id: number | null;
    storekeeper_name: string;
    storekeeper_email: string | null;
    projects: ProjectAllocationDetail[];
};

type ProjectStepOption = {
    id: number;
    name: string;
};

type ProjectItem = {
    id: number;
    name: string;
    storekeeper_id?: number | null;
    storekeeper_name?: string | null;
    materials_count?: number;
    steps?: ProjectStepOption[];
};

type MaterialMovement = {
    id: number;
    material_id: number;
    material_name: string | null;
    material_unit: string | null;
    movement_type: 'entry' | 'exit';
    quantity: number;
    reason: string | null;
    comment: string | null;
    occurred_at: string | null;
    performed_by: string | null;
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

function isLowStock(quantity: number, unit: string): boolean {
    const threshold = STOCK_THRESHOLD_BY_UNIT[normalizeKey(unit)] ?? 100;

    return quantity < threshold;
}

export default function MaterialsIndex({ 
    materials, 
    storekeeperAllocationGroups = [],
    projects = [],
    movements = [],
    selectedProjectId = null,
    selectedProjectName = null,
    nameOptions: initialNameOptions = [],
    unitOptions: initialUnitOptions = [],
    categoryOptions: initialCategoryOptions = [],
}: { 
    materials: MaterialItem[]; 
    storekeeperAllocationGroups?: StorekeeperAllocationGroup[];
    projects?: ProjectItem[];
    movements?: MaterialMovement[];
    selectedProjectId?: number | null;
    selectedProjectName?: string | null;
    nameOptions?: string[];
    unitOptions?: string[];
    categoryOptions?: string[];
}) {
    const page = usePage().props as any;
    const authenticatedUser = page?.auth?.user;
    const canCheckInFromMaterials = authenticatedUser?.role === UserRole.Magasinier.value;
    const isMagasinier = authenticatedUser?.role === UserRole.Magasinier.value;
    const isManager = authenticatedUser?.role === UserRole.Manager.value;
    const showChantierPicker = (isMagasinier || isManager) && !selectedProjectId;
    const activeChantierId = selectedProjectId ?? null;
    const activeChantierName =
        selectedProjectName ??
        projects.find((p) => p.id === activeChantierId)?.name ??
        null;

    const openChantier = (projectId: number) => {
        router.get(materialsIndex.url({ query: { project_id: projectId } }));
    };

    const backToChantiers = () => {
        router.get(materialsIndex.url());
    };
    const [searchTerm, setSearchTerm] = React.useState('');
    const [openDialog, setOpenDialog] = React.useState(false);
    const [openStockInDialog, setOpenStockInDialog] = React.useState(false);
    const [openStockOutDialog, setOpenStockOutDialog] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [editingMaterial, setEditingMaterial] = React.useState<MaterialItem | null>(null);
    const [activeTab, setActiveTab] = React.useState('stock');
    const [nameOptions, setNameOptions] = React.useState<string[]>(initialNameOptions);
    const [unitOptions, setUnitOptions] = React.useState<string[]>(initialUnitOptions);
    const [categoryOptions, setCategoryOptions] = React.useState<string[]>(initialCategoryOptions);
    const [newName, setNewName] = React.useState('');
    const [newUnit, setNewUnit] = React.useState('');
    const [newCategory, setNewCategory] = React.useState('');
    const [formData, setFormData] = React.useState({
        name: '',
        description: '',
        quantity_in_stock: '',
        unit: 'sacs',
        type: 'materiaux' as 'materiel' | 'materiaux',
        category: '',
        project_id: '',
        project_step_id: '',
    });
    const [stockMovementData, setStockMovementData] = React.useState({
        material_id: '',
        quantity: '',
        reason: '',
        comment: '',
    });

    const handleStorekeeperCheckIn = () => {
        if (!authenticatedUser?.id) {
            alert('Utilisateur non authentifié.');

            return;
        }

        const checkInProjectId = activeChantierId ?? projects[0]?.id;

        if (!checkInProjectId) {
            alert('Aucun chantier assigné pour enregistrer la présence.');

            return;
        }

        router.post('/attendance/check-in', {
            user_id: authenticatedUser.id,
            project_id: checkInProjectId,
            status: 'present',
        }, {
            onSuccess: () => {
                alert('Présence enregistrée avec succès');
            },
            onError: () => {
                alert('Erreur lors de l\'enregistrement de la présence');
            },
        });
    };

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
                total: 0,
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

    const groupedMaterials = React.useMemo(() => {
        const groups: Record<string, {
            storekeeper_name: string;
            projects: Record<number, {
                project_name: string;
                categories: Record<string, {
                    category_name: string;
                    materials: MaterialItem[];
                }>;
            }>;
        }> = {};

        filteredMaterials.forEach((material) => {
            const storekeeperName = material.project?.storekeeper?.name || 'Stock Principal';
            const projectId = material.project_id || 0;
            const projectName = material.project?.name || 'Général';
            const categoryName = material.category || (material.type === 'materiel' ? 'Équipement' : 'Divers');

            if (!groups[storekeeperName]) {
                groups[storekeeperName] = {
                    storekeeper_name: storekeeperName,
                    projects: {},
                };
            }

            if (!groups[storekeeperName].projects[projectId]) {
                groups[storekeeperName].projects[projectId] = {
                    project_name: projectName,
                    categories: {},
                };
            }

            if (!groups[storekeeperName].projects[projectId].categories[categoryName]) {
                groups[storekeeperName].projects[projectId].categories[categoryName] = {
                    category_name: categoryName,
                    materials: [],
                };
            }

            groups[storekeeperName].projects[projectId].categories[categoryName].materials.push(material);
        });

        // Convert nested objects to sorted arrays
        return Object.values(groups)
            .sort((a, b) => a.storekeeper_name.localeCompare(b.storekeeper_name))
            .map(group => ({
                ...group,
                projects: Object.values(group.projects)
                    .sort((a, b) => a.project_name.localeCompare(b.project_name))
                    .map(project => ({
                        ...project,
                        categories: Object.values(project.categories).sort((a, b) => a.category_name.localeCompare(b.category_name))
                    }))
            }));
    }, [filteredMaterials]);

    const stockNameLists = React.useMemo(() => {
        const inStock = filteredMaterials.filter((material) => material.quantity > 0);

        const uniqueNames = (items: typeof inStock) =>
            [...new Set(items.map((material) => material.name.trim()).filter(Boolean))].sort((a, b) =>
                a.localeCompare(b, 'fr'),
            );

        return {
            all: uniqueNames(inStock),
            consumables: uniqueNames(inStock.filter((material) => material.type === 'materiaux')),
            equipment: uniqueNames(inStock.filter((material) => material.type === 'materiel')),
            lowStock: uniqueNames(inStock.filter((material) => material.lowStock)),
        };
    }, [filteredMaterials]);

    const projectsWithStorekeeper = React.useMemo(
        () => projects.filter(
            (p) => p.storekeeper_id != null && p.storekeeper_id !== '' && (p.steps?.length ?? 0) > 0,
        ),
        [projects],
    );

    const stepsForMaterialForm = React.useMemo(() => {
        if (editingMaterial) {
            return [];
        }

        if (isManager) {
            const project = projectsWithStorekeeper.find(
                (p) => p.id.toString() === formData.project_id,
            );

            return project?.steps ?? [];
        }

        if (isMagasinier && activeChantierId) {
            const project = projects.find((p) => p.id === activeChantierId);

            return project?.steps ?? [];
        }

        return projects[0]?.steps ?? [];
    }, [activeChantierId, editingMaterial, isMagasinier, isManager, formData.project_id, projects, projectsWithStorekeeper]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'unit' && value === '__new_unit__') {
            setFormData((prev) => ({ ...prev, unit: '' }));
            return;
        }

        if (name === 'category' && value === '__new_category__') {
            setFormData((prev) => ({ ...prev, category: '' }));
            return;
        }

        if (name === 'name' && value === '__new_name__') {
            setFormData((prev) => ({ ...prev, name: '' }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value,
            ...(name === 'project_id' ? { project_step_id: '' } : {}),
        }));
    };

    const addCustomUnit = () => {
        const trimmed = newUnit.trim();
        if (!trimmed) {
            return;
        }

        setUnitOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setFormData((prev) => ({ ...prev, unit: trimmed }));
        setNewUnit('');
    };

    const addCustomCategory = () => {
        const trimmed = newCategory.trim();
        if (!trimmed) {
            return;
        }

        setCategoryOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setFormData((prev) => ({ ...prev, category: trimmed }));
        setNewCategory('');
    };

    const addCustomName = () => {
        const trimmed = newName.trim();
        if (!trimmed) {
            return;
        }

        setNameOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setFormData((prev) => ({ ...prev, name: trimmed }));
        setNewName('');
    };

    const handleSubmitMaterial = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isManager && !editingMaterial && !activeChantierId && !formData.project_id) {
            alert('Sélectionnez un chantier avant de créer un matériau.');

            return;
        }

        if (!editingMaterial && !formData.project_step_id) {
            alert('Sélectionnez une étape du chantier pour ce matériau.');

            return;
        }

        setIsSubmitting(true);

        try {
            const url = editingMaterial ? update.url({ material: editingMaterial.id }) : store.url();
            const method = editingMaterial ? 'put' : 'post';

            const { project_id, ...formFieldsWithoutProject } = formData;

            const payload = editingMaterial
                ? formFieldsWithoutProject
                : isManager
                    ? { ...formFieldsWithoutProject, project_id: activeChantierId ?? Number(project_id) }
                    : isMagasinier && activeChantierId
                        ? { ...formFieldsWithoutProject, project_id: activeChantierId }
                        : formFieldsWithoutProject;

            router.visit(url, {
                method,
                data: payload,
                onSuccess: () => {
                    setFormData({
                        name: '',
                        description: '',
                        quantity_in_stock: '',
                        unit: 'sacs',
                        type: 'materiaux',
                        category: '',
                        project_id: '',
                        project_step_id: '',
                    });
                    setNewUnit('');
                    setNewCategory('');
                    setEditingMaterial(null);
                    setOpenDialog(false);
                    alert(editingMaterial ? 'Matériel mis à jour avec succès' : 'Matériel créé avec succès');
                },
                onError: () => {
                    alert(editingMaterial ? 'Erreur lors de la mise à jour du matériel' : 'Erreur lors de la création du matériel');
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
        if (material.name && !nameOptions.includes(material.name)) {
            setNameOptions((prev) => [...prev, material.name]);
        }

        if (material.unit && !unitOptions.includes(material.unit)) {
            setUnitOptions((prev) => [...prev, material.unit]);
        }

        if (material.category && !categoryOptions.includes(material.category)) {
            setCategoryOptions((prev) => [...prev, material.category]);
        }

        setEditingMaterial(material);
        setFormData({
            name: material.name,
            description: material.description || '',
            quantity_in_stock: material.quantity_in_stock.toString(),
            unit: material.unit,
            type: material.type || 'materiaux',
            category: material.category || '',
            project_id: '',
            project_step_id: '',
        });
        setOpenDialog(true);
    };

    const handleDelete = (id: number) => {
        if (!window.confirm('Supprimer ce matériau ?')) {
            return;
        }

        router.delete(destroy.url({ material: id }), {
            onSuccess: () => {
                // Page will be refreshed automatically by Inertia
            },
            onError: () => {
                alert('Erreur lors de la suppression');
            },
        });
    };

    const handleMovementChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setStockMovementData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const submitStockMovement = (routeUrl: string, successCallback: () => void) => {
        setIsSubmitting(true);

        router.visit(routeUrl, {
            method: 'post',
            data: {
                material_id: Number(stockMovementData.material_id),
                quantity: Number(stockMovementData.quantity),
                reason: stockMovementData.reason || null,
                comment: stockMovementData.comment || null,
            },
            onSuccess: () => {
                setStockMovementData({ material_id: '', quantity: '', reason: '', comment: '' });
                successCallback();
            },
            onError: () => {
                alert('Erreur lors de l\'enregistrement du mouvement de stock');
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    const handleStockInSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitStockMovement(stockIn.url(), () => setOpenStockInDialog(false));
    };

    const handleStockOutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitStockMovement(stockOut.url(), () => setOpenStockOutDialog(false));
    };

    if (showChantierPicker) {
        return (
            <>
                <Head title="Chantiers — Matériaux" />
                <div className="space-y-8">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900">{isManager ? 'Chantiers' : 'Mes chantiers'}</h1>
                        <p className="mt-1 font-medium text-slate-500">
                            {isManager
                                ? 'Choisissez un chantier pour gérer son stock, ses entrées et ses sorties.'
                                : 'Choisissez un chantier pour gérer le stock, les entrées et les sorties de matériaux.'}
                        </p>
                    </div>

                    {projects.length === 0 ? (
                        <Card className="rounded-3xl border-amber-200 bg-amber-50">
                            <CardContent className="p-8 text-center text-amber-900">
                                <p className="font-bold">Aucun chantier ne vous est assigné pour le moment.</p>
                                <p className="mt-2 text-sm">Contactez le manager ou l&apos;ingénieur responsable.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() => openChantier(project.id)}
                                    className="group rounded-[32px] border border-slate-200 bg-white p-6 text-left shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-blue-500/10"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                            <Package className="h-7 w-7" />
                                        </div>
                                        <ChevronRight className="h-6 w-6 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500" />
                                    </div>
                                    <h2 className="mt-4 text-2xl font-black text-slate-900">{project.name}</h2>
                                    <p className="mt-2 text-sm font-bold text-slate-500">
                                        {(project.materials_count ?? 0) === 1
                                            ? '1 article en inventaire'
                                            : `${project.materials_count ?? 0} articles en inventaire`}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {(project.steps?.length ?? 0) > 0
                                            ? `${project.steps?.length} étape(s) — stock dédié à ce chantier`
                                            : 'Ajoutez des étapes sur la fiche chantier pour créer des matériaux'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={activeChantierName ? `Stock — ${activeChantierName}` : 'Matériaux'} />

      <div className="space-y-6">
        <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {(isMagasinier || isManager) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={backToChantiers}
                  className="mt-1 h-11 shrink-0 rounded-xl"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Chantiers
                </Button>
              )}
              <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">
                {activeChantierName ? `Stock — ${activeChantierName}` : 'Magasin & Stock'}
              </h1>
              <p className="mt-1 text-slate-500 font-medium">
                {isMagasinier && activeChantierName
                  ? 'Matériaux, entrées et sorties pour ce chantier uniquement'
                  : 'Gestion des matériaux et inventaire Lubumbashi'}
              </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canCheckInFromMaterials && activeChantierId && (
                <Button onClick={handleStorekeeperCheckIn} variant="outline" className="h-12 rounded-xl">
                  Pointer ma présence
                </Button>
              )}

              {(isMagasinier || isManager) && activeChantierId && (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      setStockMovementData((prev) => ({ ...prev, material_id: '' }));
                      setOpenStockInDialog(true);
                    }}
                    className="h-12 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    + Entrée stock
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStockMovementData((prev) => ({ ...prev, material_id: '' }));
                      setOpenStockOutDialog(true);
                    }}
                    className="h-12 rounded-xl border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    - Sortie stock
                  </Button>
                </>
              )}

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
                                    <Label htmlFor="name">Type de matériau *</Label>
                                    {editingMaterial ? (
                                        <Input
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            placeholder="Ex: Bêche, Marteau, Ciment..."
                                            required
                                        />
                                    ) : (
                                        <>
                                            <select
                                                id="name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                                required
                                            >
                                                <option value="">-- Choisir un matériau --</option>
                                                {nameOptions.map((name) => (
                                                    <option key={name} value={name}>
                                                        {name}
                                                    </option>
                                                ))}
                                                <option value="__new_name__">+ Ajouter un type</option>
                                            </select>
                                            {(formData.name === '' || !nameOptions.includes(formData.name)) && (
                                                <div className="mt-2 flex gap-2">
                                                    <Input
                                                        value={newName}
                                                        onChange={(event) => setNewName(event.target.value)}
                                                        placeholder="Nouveau type (ex: Bêche, Marteau)"
                                                    />
                                                    <Button type="button" variant="outline" onClick={addCustomName}>
                                                        Ajouter
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
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
                                            <option value="">-- Choisir une unité --</option>
                                            {unitOptions.map((unit) => (
                                                <option key={unit} value={unit}>
                                                    {unit}
                                                </option>
                                            ))}
                                            <option value="__new_unit__">+ Ajouter une unité</option>
                                        </select>
                                        {(formData.unit === '' || !unitOptions.includes(formData.unit)) && (
                                            <div className="mt-2 flex gap-2">
                                                <Input
                                                    value={newUnit}
                                                    onChange={(event) => setNewUnit(event.target.value)}
                                                    placeholder="Nouvelle unité (ex: rouleaux)"
                                                />
                                                <Button type="button" variant="outline" onClick={addCustomUnit}>
                                                    Ajouter
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="type">Type de Ressource *</Label>
                                    <select
                                        id="type"
                                        name="type"
                                        value={formData.type}
                                        onChange={handleFormChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        required
                                    >
                                        <option value="materiaux">Matériaux (Consommables / Pas de retour)</option>
                                        <option value="materiel">Matériel (Outils / Équipements / Retournable)</option>
                                    </select>
                                </div>

                                <div>
                                    <Label htmlFor="category">Catégorie du matériau</Label>
                                    <select
                                        id="category"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleFormChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                    >
                                        <option value="">-- Choisir une catégorie --</option>
                                        {categoryOptions.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                        <option value="__new_category__">+ Ajouter une catégorie</option>
                                    </select>
                                    {(formData.category === '' || !categoryOptions.includes(formData.category)) && (
                                        <div className="mt-2 flex gap-2">
                                            <Input
                                                value={newCategory}
                                                onChange={(event) => setNewCategory(event.target.value)}
                                                placeholder="Nouvelle catégorie (ex: Plomberie)"
                                            />
                                            <Button type="button" variant="outline" onClick={addCustomCategory}>
                                                Ajouter
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {isManager && !editingMaterial && !activeChantierId && (
                                    <div className="space-y-2">
                                        <Label htmlFor="material-project">Chantier (magasinier responsable) *</Label>
                                        {projectsWithStorekeeper.length === 0 ? (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                                Aucun chantier prêt : il faut un magasinier assigné et au moins une étape.{' '}
                                                <Link href={projectsIndex.url()} className="font-bold underline">
                                                    Ouvrir les projets
                                                </Link>
                                            </div>
                                        ) : (
                                            <>
                                                <select
                                                    id="material-project"
                                                    name="project_id"
                                                    value={formData.project_id}
                                                    onChange={handleFormChange}
                                                    required
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                                >
                                                    <option value="">-- Choisir un chantier --</option>
                                                    {projectsWithStorekeeper.map((project) => (
                                                        <option key={project.id} value={project.id.toString()}>
                                                            {project.name}
                                                            {project.storekeeper_name ? ` — ${project.storekeeper_name}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-slate-500">
                                                    Le stock est enregistré sous le magasinier déjà affecté à ce chantier.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {!editingMaterial && (
                                    <div className="space-y-2">
                                        <Label htmlFor="material-step">Étape du chantier *</Label>
                                        {stepsForMaterialForm.length === 0 ? (
                                            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                                {isManager && !formData.project_id
                                                    ? 'Choisissez d\'abord un chantier.'
                                                    : 'Ce chantier n\'a pas encore d\'étape. Ajoutez-en une sur la fiche du chantier.'}
                                            </p>
                                        ) : (
                                            <select
                                                id="material-step"
                                                name="project_step_id"
                                                value={formData.project_step_id}
                                                onChange={handleFormChange}
                                                required
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                            >
                                                <option value="">-- Choisir une étape --</option>
                                                {stepsForMaterialForm.map((step) => (
                                                    <option key={step.id} value={step.id.toString()}>
                                                        {step.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" onClick={() => {
  setEditingMaterial(null); setFormData({ name: '', description: '', quantity_in_stock: '', unit: 'sacs', type: 'materiaux', category: '', project_id: '', project_step_id: '' }); setNewUnit(''); setNewCategory('');
}}>Annuler</Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        disabled={
                                            isSubmitting
                                            || (isManager && !editingMaterial && projectsWithStorekeeper.length === 0)
                                            || (!editingMaterial && stepsForMaterialForm.length === 0)
                                        }
                                    >
                                        {isSubmitting ? 'Enregistrement...' : (editingMaterial ? 'Modifier' : 'Créer')}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={openStockInDialog} onOpenChange={setOpenStockInDialog}>
                        <DialogContent>
                            <DialogTitle>Entrée de stock</DialogTitle>
                            <form className="mt-4 space-y-4" onSubmit={handleStockInSubmit}>
                                <div>
                                    <Label htmlFor="material-in">Matériau *</Label>
                                    <select
                                        id="material-in"
                                        name="material_id"
                                        value={stockMovementData.material_id}
                                        onChange={handleMovementChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        required
                                    >
                                        <option value="">-- Sélectionner un matériau --</option>
                                        {normalizedMaterials.map((material) => (
                                            <option key={material.id} value={material.id.toString()}>{material.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <Label htmlFor="qty-in">Quantité *</Label>
                                    <Input id="qty-in" name="quantity" type="number" min="0.01" step="0.01" value={stockMovementData.quantity} onChange={handleMovementChange} required />
                                </div>

                                <div>
                                    <Label htmlFor="reason-in">Motif d'entrée *</Label>
                                    <select
                                        id="reason-in"
                                        name="reason"
                                        value={stockMovementData.reason}
                                        onChange={handleMovementChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        required
                                    >
                                        <option value="">-- Sélectionner un motif --</option>
                                        <option value="restock">Réapprovisionnement (Achat)</option>
                                        {materials.find(m => m.id.toString() === stockMovementData.material_id)?.type === 'materiel' && (
                                            <option value="retour_chantier">Retour de Chantier</option>
                                        )}
                                        <option value="ajustement">Ajustement d'inventaire</option>
                                    </select>
                                </div>

                                <div>
                                    <Label htmlFor="comment-in">Commentaire</Label>
                                    <textarea id="comment-in" name="comment" value={stockMovementData.comment} onChange={handleMovementChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" rows={3} />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setOpenStockInDialog(false)}>Annuler</Button>
                                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>{isSubmitting ? 'Enregistrement...' : 'Valider entrée'}</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={openStockOutDialog} onOpenChange={setOpenStockOutDialog}>
                        <DialogContent>
                            <DialogTitle>Sortie de stock</DialogTitle>
                            <form className="mt-4 space-y-4" onSubmit={handleStockOutSubmit}>
                                <div>
                                    <Label htmlFor="material-out">Matériau *</Label>
                                    <select
                                        id="material-out"
                                        name="material_id"
                                        value={stockMovementData.material_id}
                                        onChange={handleMovementChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        required
                                    >
                                        <option value="">-- Sélectionner un matériau --</option>
                                        {normalizedMaterials.map((material) => (
                                            <option key={material.id} value={material.id.toString()}>{material.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <Label htmlFor="qty-out">Quantité *</Label>
                                    <Input id="qty-out" name="quantity" type="number" min="0.01" step="0.01" value={stockMovementData.quantity} onChange={handleMovementChange} required />
                                </div>

                                <div>
                                    <Label htmlFor="reason-out">Motif de sortie *</Label>
                                    <select
                                        id="reason-out"
                                        name="reason"
                                        value={stockMovementData.reason}
                                        onChange={handleMovementChange}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        required
                                    >
                                        <option value="">-- Sélectionner un motif --</option>
                                        <option value="perte">Perte / Vol</option>
                                        <option value="casse">Casse / Détérioration</option>
                                        <option value="ajustement">Ajustement d'inventaire</option>
                                    </select>
                                </div>

                                <div>
                                    <Label htmlFor="comment-out">Commentaire</Label>
                                    <textarea id="comment-out" name="comment" value={stockMovementData.comment} onChange={handleMovementChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" rows={3} />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setOpenStockOutDialog(false)}>Annuler</Button>
                                    <Button type="submit" className="bg-rose-600 hover:bg-rose-700" disabled={isSubmitting}>{isSubmitting ? 'Enregistrement...' : 'Valider sortie'}</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
        </div>

        {/* Stock overview — noms des matériaux, pas des totaux */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 lg:col-span-3">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                        <Package className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Inventaire</p>
                        <p className="text-lg font-black text-slate-900">Matériaux en stock</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {stockNameLists.all.length > 0 ? (
                        stockNameLists.all.map((materialName) => (
                            <Badge
                                key={materialName}
                                variant="outline"
                                className="rounded-full border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                            >
                                {materialName}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-sm font-medium text-slate-500">Aucun matériau en stock pour le moment.</p>
                    )}
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <List className="h-5 w-5 text-emerald-600" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Consommables</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {stockNameLists.consumables.length > 0 ? (
                        stockNameLists.consumables.map((materialName) => (
                            <Badge key={materialName} variant="outline" className="rounded-full border-emerald-200 bg-white text-xs font-semibold text-emerald-800">
                                {materialName}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-xs text-emerald-700/80">—</p>
                    )}
                </div>
              </div>
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50/80 p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Wrench className="h-5 w-5 text-indigo-600" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Équipements</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {stockNameLists.equipment.length > 0 ? (
                        stockNameLists.equipment.map((materialName) => (
                            <Badge key={materialName} variant="outline" className="rounded-full border-indigo-200 bg-white text-xs font-semibold text-indigo-800">
                                {materialName}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-xs text-indigo-700/80">—</p>
                    )}
                </div>
              </div>
              <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Alertes stock</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {stockNameLists.lowStock.length > 0 ? (
                        stockNameLists.lowStock.map((materialName) => (
                            <Badge key={materialName} variant="outline" className="rounded-full border-amber-200 bg-white text-xs font-semibold text-amber-900">
                                {materialName}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-xs text-amber-700/80">Aucune alerte</p>
                    )}
                </div>
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
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`rounded-xl px-8 py-3 font-bold transition-all ${activeTab === 'movements' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ClipboardCheck className="mr-2 h-4 w-4 inline-block" />
                        Entrées / Sorties
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
                <div className="space-y-6">
                    {groupedMaterials.length > 0 ? (
                        groupedMaterials.map((group) => (
                            <Collapsible
                                key={group.storekeeper_name}
                                defaultOpen={true}
                                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40"
                            >
                                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-slate-50/90">
                                    <div className="flex items-center gap-5">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-inner">
                                            <User className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">Responsable Magasin</p>
                                            <p className="text-xl font-black text-slate-900">{group.storekeeper_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Badge variant="outline" className="rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                            {group.projects.length} chantier{group.projects.length > 1 ? 's' : ''}
                                        </Badge>
                                        <ChevronDown className="h-6 w-6 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="border-t border-slate-100 bg-slate-50/30 p-6">
                                    <div className="space-y-10">
                                        {group.projects.map((project) => (
                                            <div key={project.project_name} className="space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-1.5 w-10 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20"></div>
                                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Chantier : {project.project_name}</h3>
                                                </div>
                                                
                                                <div className="space-y-8">
                                                    {project.categories.map((category) => (
                                                        <div key={category.category_name} className="space-y-4">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold px-3 py-1 text-[10px] uppercase tracking-wider rounded-lg">
                                                                    {category.category_name}
                                                                </Badge>
                                                                <div className="h-[1px] flex-1 bg-slate-200"></div>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                                                {category.materials.map((material) => (
                                                                    <Card key={material.id} className="group relative rounded-[32px] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40 transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden">
                                                                        <CardHeader className="space-y-4 p-6 pb-0">
                                                                <div className="flex items-start justify-between">
                                                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-500 ${material.type === 'materiel' ? 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600' : 'bg-amber-100 text-amber-600 group-hover:bg-amber-600'} group-hover:text-white`}>
                                                                        {material.type === 'materiel' ? <Wrench className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Badge variant="outline" className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${material.type === 'materiel' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}>
                                                                            {material.type === 'materiel' ? 'Équipement' : 'Consommable'}
                                                                        </Badge>
                                                                        <Badge className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${material.lowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                            {material.lowStock ? 'Alerte Stock' : 'Disponible'}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <CardTitle className="text-2xl font-black leading-tight text-slate-900">{material.name}</CardTitle>
                                                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{material.supplier}</p>
                                                                    </div>
                                                                    
                                                                    <div className="flex gap-4 pt-2">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-black uppercase text-slate-400">En Magasin</span>
                                                                            <span className="text-xl font-black text-slate-900">{material.quantity_in_stock} {material.unit}</span>
                                                                        </div>
                                                                        {material.on_site_quantity > 0 && (
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-black uppercase text-blue-500">Sur Chantier</span>
                                                                                <span className="text-xl font-black text-blue-600">{material.on_site_quantity} {material.unit}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </CardHeader>

                                                            <CardContent className="space-y-6 p-6">
                                                                <div className="space-y-6">
                                                                    <div className="grid grid-cols-1 gap-3">
                                                                        {material.type === 'materiel' ? (
                                                                            <div className="rounded-2xl bg-indigo-50 p-4 border border-indigo-100 text-center">
                                                                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-1">Total Possédé</p>
                                                                                <p className="text-xl font-black text-indigo-900">{material.quantity_in_stock + material.on_site_quantity} {material.unit}</p>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 text-center">
                                                                                <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider mb-1">Stock Disponible</p>
                                                                                <p className="text-xl font-black text-amber-900">{material.quantity_in_stock} {material.unit}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                                                        <Button
                                                                            onClick={() => {
                                                                                setStockMovementData((prev) => ({ ...prev, material_id: material.id.toString() }));
                                                                                setOpenStockInDialog(true);
                                                                            }}
                                                                            className="h-11 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600"
                                                                        >
                                                                            + Entrée
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => {
                                                                                setStockMovementData((prev) => ({ ...prev, material_id: material.id.toString() }));
                                                                                setOpenStockOutDialog(true);
                                                                            }}
                                                                            variant="outline"
                                                                            className="h-11 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                                                                        >
                                                                            - Sortie
                                                                        </Button>
                                                                    </div>

                                                                    {material.type === 'materiel' && material.allocations?.length > 0 && (
                                                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                                                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Utilisation en cours</p>
                                                                            <div className="space-y-2">
                                                                                {material.allocations.map((alloc) => (
                                                                                    <div key={alloc.id} className="flex items-center justify-between bg-blue-50/50 p-2 rounded-xl border border-blue-100">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-[11px] font-bold text-blue-900">{alloc.project_name}</span>
                                                                                            <span className="text-[10px] text-blue-600 font-medium">{alloc.quantity} {material.unit}</span>
                                                                                        </div>
                                                                                        <Button 
                                                                                            size="sm" 
                                                                                            variant="ghost"
                                                                                            onClick={() => router.visit(returnMaterial.url({ resourceRequest: alloc.id }), { method: 'post' })}
                                                                                            className="h-7 px-2 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                                                                                        >
                                                                                            Remettre
                                                                                        </Button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="pt-4 space-y-3">
                                                                        <div className={`grid gap-3 ${isMagasinier ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                                                            <Button onClick={() => handleEdit(material)} variant="outline" className="h-11 rounded-xl border-blue-100 bg-blue-50/50 font-bold text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Modifier
                                                                            </Button>
                                                                            {!isMagasinier && (
                                                                                <Button
                                                                                    onClick={() => handleDelete(material.id)}
                                                                                    variant="outline"
                                                                                    className="h-11 rounded-xl border-rose-100 bg-rose-50/50 font-bold text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
                            <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                            <p className="text-xl font-black text-slate-900">Aucun matériau trouvé</p>
                            <p className="mt-2 font-medium text-slate-500">Essayez de modifier votre recherche ou filtrez par un autre chantier.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'allocations' && (
                <div className="space-y-4">
                    {storekeeperAllocationGroups.length > 0 ? (
                        storekeeperAllocationGroups.map((group) => (
                            <Collapsible
                                key={group.storekeeper_id ?? `sk-none-${group.storekeeper_name}`}
                                defaultOpen={false}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                            >
                                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-slate-50/90">
                                    <div className="flex min-w-0 flex-1 items-center gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Magasinier du chantier</p>
                                            <p className="truncate text-lg font-black text-slate-900">{group.storekeeper_name}</p>
                                            {group.storekeeper_email ? (
                                                <p className="truncate text-xs font-medium text-slate-500">{group.storekeeper_email}</p>
                                            ) : null}
                                            <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                                Matériaux et matériel affectés aux chantiers suivis par ce magasinier — ouvrez pour le détail.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase">
                                            {group.projects.length} chantier{group.projects.length > 1 ? 's' : ''}
                                        </Badge>
                                        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-5 border-t border-slate-100 bg-slate-50/50 p-5">
                                        {group.projects.map((proj) => (
                                            <div
                                                key={proj.project_id}
                                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                            >
                                                <p className="mb-4 text-[10px] font-black uppercase tracking-wider text-blue-600">
                                                    Chantier — {proj.project_name}
                                                </p>
                                                <div className="grid gap-6 md:grid-cols-2">
                                                    <div>
                                                        <p className="mb-2 text-[10px] font-black uppercase text-amber-600">Matériaux (consommables)</p>
                                                        {proj.materiaux.length === 0 ? (
                                                            <p className="text-xs italic text-slate-400">Aucun consommable affecté sur ce chantier.</p>
                                                        ) : (
                                                            <ul className="space-y-2">
                                                                {proj.materiaux.map((line) => (
                                                                    <li
                                                                        key={line.resource_request_id}
                                                                        className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm"
                                                                    >
                                                                        <span className="font-bold text-slate-800">{line.name}</span>
                                                                        <span className="font-black text-amber-900">
                                                                            {line.quantity} {line.unit}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="mb-2 text-[10px] font-black uppercase text-indigo-600">Matériel (équipement)</p>
                                                        {proj.materiel.length === 0 ? (
                                                            <p className="text-xs italic text-slate-400">Aucun équipement en service sur ce chantier.</p>
                                                        ) : (
                                                            <ul className="space-y-2">
                                                                {proj.materiel.map((line) => (
                                                                    <li
                                                                        key={line.resource_request_id}
                                                                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm"
                                                                    >
                                                                        <span className="font-bold text-slate-800">{line.name}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-800">
                                                                                {line.quantity} {line.unit}
                                                                            </span>
                                                                            <Button
                                                                                size="sm"
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    router.visit(
                                                                                        returnMaterial.url({
                                                                                            resourceRequest: line.resource_request_id,
                                                                                        }),
                                                                                        { method: 'post' }
                                                                                    )
                                                                                }
                                                                                className="h-8 rounded-lg bg-indigo-600 px-3 text-[10px] font-black uppercase text-white hover:bg-indigo-700"
                                                                            >
                                                                                Remettre
                                                                            </Button>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
                            <p className="text-xl font-black text-slate-900">Aucune affectation enregistrée</p>
                            <p className="mt-2 font-medium text-slate-500">
                                Les livraisons vers chantier (par magasinier) apparaissent ici, regroupées par responsable magasin.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'movements' && (
                <Card className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30">
                    <CardHeader>
                        <CardTitle className="text-xl font-black">Historique des mouvements de stock</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {movements.length === 0 ? (
                            <p className="text-slate-500 font-medium">Aucun mouvement enregistré.</p>
                        ) : (
                            <div className="space-y-3">
                                {movements.map((movement) => (
                                    <div key={movement.id} className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-900">{movement.material_name ?? 'Matériau inconnu'}</p>
                                                <Badge variant="outline" className="text-[10px] uppercase font-black px-1.5 h-4 border-slate-200 text-slate-500">
                                                    {movement.reason === 'restock' ? 'Réappro' : 
                                                     movement.reason === 'retour_chantier' ? 'Retour' : 
                                                     movement.reason === 'allocation' ? 'Affectation' : 
                                                     movement.reason === 'perte' ? 'Perte' : 
                                                     movement.reason === 'casse' ? 'Casse' : 
                                                     movement.reason === 'ajustement' ? 'Ajustement' : 'Manuel'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 italic mt-0.5">
                                                {movement.comment || 'Aucun commentaire supplémentaire'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-tighter">
                                                <span className="text-blue-600/50">PAR:</span> {movement.performed_by ?? 'Système'} 
                                                <span className="mx-1">•</span> 
                                                {movement.occurred_at ? new Date(movement.occurred_at).toLocaleString('fr-FR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : '-'}
                                            </p>
                                        </div>
                                        <Badge className={movement.movement_type === 'entry' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>
                                            {movement.movement_type === 'entry' ? '+' : '-'} {movement.quantity} {movement.material_unit ?? ''}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
      </div>
    </>
  );
}
