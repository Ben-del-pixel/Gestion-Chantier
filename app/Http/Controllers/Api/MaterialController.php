<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\MaterialMovement;
use App\Models\Project;
use App\Models\ResourceRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class MaterialController extends Controller
{
    private function canManageMaterials(): bool
    {
        $role = auth()->user()?->role;

        return in_array(
            $role,
            [
                UserRole::Magasinier,
                UserRole::Manager,
                UserRole::Magasinier->value,
                UserRole::Manager->value,
            ],
            true
        );
    }

    public function index(Request $request): Response
    {
        $user = auth()->user();
        $projectFilter = $request->query('project_id');

        // Manager sees all materials (optionally filtered by project)
        if ($user->role === UserRole::Manager) {
            $materialsQuery = Material::when($projectFilter, function ($q) use ($projectFilter) {
                $q->where('project_id', $projectFilter);
            })->latest('updated_at');
        } elseif ($user->role === UserRole::Magasinier) {
            // Magasinier sees only materials of their assigned project
            // Find project where this user is the storekeeper
            $userProject = Project::where('storekeeper_id', $user->id)->first();
            if (! $userProject) {
                // No project assigned, show empty materials
                $materialsQuery = Material::where('id', null);
            } else {
                $materialsQuery = Material::where('project_id', $userProject->id)->latest('updated_at');
            }
        } else {
            // Other roles see no materials
            $materialsQuery = Material::where('id', null);
        }

        $materials = $materialsQuery->get()
            ->map(function ($material) {
                $allocations = ResourceRequest::where('material_id', $material->id)
                    ->where('status', 'livre')
                    ->with('project:id,name')
                    ->get()
                    ->map(function ($req) {
                        return [
                            'id' => $req->id,
                            'project_name' => $req->project?->name,
                            'quantity' => (float) $req->quantity_requested,
                        ];
                    });

                $material->on_site_quantity = $allocations->sum('quantity');
                $material->allocations = $allocations;

                return $material;
            });

        $storekeeperAllocationGroups = $this->buildStorekeeperAllocationGroups($user);

        $projects = $this->projectsForMaterialsPage($user);

        // Filter movements by materials the user can see
        $movementsQuery = MaterialMovement::query()
            ->with(['material:id,name,unit', 'user:id,name']);

        if ($user->role === UserRole::Magasinier) {
            $userProject = Project::where('storekeeper_id', $user->id)->first();
            if ($userProject) {
                $movementsQuery->whereIn('material_id', Material::where('project_id', $userProject->id)->pluck('id'));
            }
        }

        $movements = $movementsQuery->latest('occurred_at')
            ->limit(40)
            ->get()
            ->map(function (MaterialMovement $movement) {
                return [
                    'id' => $movement->id,
                    'material_id' => $movement->material_id,
                    'material_name' => $movement->material?->name,
                    'material_unit' => $movement->material?->unit,
                    'movement_type' => $movement->movement_type,
                    'quantity' => (float) $movement->quantity,
                    'reason' => $movement->reason,
                    'comment' => $movement->comment,
                    'occurred_at' => optional($movement->occurred_at)?->toIso8601String(),
                    'performed_by' => $movement->user?->name,
                ];
            })
            ->values();

        return Inertia::render('materials/index', [
            'materials' => $materials,
            'storekeeperAllocationGroups' => $storekeeperAllocationGroups,
            'projects' => $projects,
            'movements' => $movements,
        ]);
    }

    /**
     * @return Collection<int, array{id: int, name: string, storekeeper_id: int|null, storekeeper_name: string|null}>
     */
    private function projectsForMaterialsPage(User $user): Collection
    {
        $query = Project::query()
            ->with('storekeeper:id,name')
            ->select('id', 'name', 'storekeeper_id')
            ->orderBy('name');

        if ($user->role === UserRole::Magasinier) {
            $query->where('storekeeper_id', $user->id);
        }

        return $query->get()->map(fn (Project $project) => [
            'id' => $project->id,
            'name' => $project->name,
            'storekeeper_id' => $project->storekeeper_id,
            'storekeeper_name' => $project->storekeeper?->name,
        ]);
    }

    /**
     * @return list<array{storekeeper_id: int|null, storekeeper_name: string, storekeeper_email: string|null, projects: list<array<string, mixed>>}>
     */
    private function buildStorekeeperAllocationGroups(User $user): array
    {
        if ($user->role !== UserRole::Manager && $user->role !== UserRole::Magasinier) {
            return [];
        }

        $query = ResourceRequest::query()
            ->where('status', 'livre')
            ->with([
                'project:id,name,storekeeper_id',
                'project.storekeeper:id,name,email',
                'material:id,name,unit,type',
            ]);

        if ($user->role === UserRole::Magasinier) {
            $query->whereHas('project', function ($q) use ($user) {
                $q->where('storekeeper_id', $user->id);
            });
        }

        /** @var Collection<int, ResourceRequest> $rows */
        $rows = $query->get()->filter(fn (ResourceRequest $r) => $r->project !== null);

        return $rows
            ->groupBy(fn (ResourceRequest $r) => $r->project?->storekeeper_id ?? 'none')
            ->map(function (Collection $group, mixed $storekeeperKey) {
                $storekeeper = $group->first()?->project?->storekeeper;
                $storekeeperId = $storekeeperKey === 'none' ? null : (int) $storekeeperKey;

                $projects = $group
                    ->groupBy('project_id')
                    ->map(function (Collection $projectRows) {
                        $project = $projectRows->first()->project;
                        if (! $project) {
                            return null;
                        }

                        $materiaux = [];
                        $materiel = [];

                        foreach ($projectRows as $item) {
                            $type = (string) ($item->material?->type ?? 'materiaux');
                            $line = [
                                'resource_request_id' => $item->id,
                                'material_id' => $item->material_id,
                                'name' => $item->material?->name,
                                'quantity' => (float) $item->quantity_requested,
                                'unit' => (string) ($item->material?->unit ?? ''),
                                'type' => $type,
                            ];

                            if ($type === 'materiel') {
                                $materiel[] = $line;
                            } else {
                                $materiaux[] = $line;
                            }
                        }

                        return [
                            'project_id' => $project->id,
                            'project_name' => $project->name,
                            'materiaux' => $materiaux,
                            'materiel' => $materiel,
                        ];
                    })
                    ->filter()
                    ->sortBy('project_name')
                    ->values()
                    ->all();

                return [
                    'storekeeper_id' => $storekeeperId,
                    'storekeeper_name' => $storekeeper?->name ?? 'Sans magasinier assigné',
                    'storekeeper_email' => $storekeeper?->email,
                    'projects' => $projects,
                ];
            })
            ->values()
            ->sortBy('storekeeper_name')
            ->values()
            ->all();
    }

    public function store(Request $request)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut créer des matériaux');
        }

        $user = auth()->user();

        $rules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'type' => 'required|in:materiel,materiaux',
            'category' => 'nullable|string|max:255',
        ];

        if ($user->role === UserRole::Manager) {
            $rules['project_id'] = 'required|exists:projects,id';
        } else {
            $rules['project_id'] = 'nullable|exists:projects,id';
        }

        $validated = $request->validate($rules);

        // If Magasinier creates material, auto-assign to their project
        if ($user->role === UserRole::Magasinier) {
            unset($validated['project_id']);
            $userProject = Project::where('storekeeper_id', $user->id)->first();
            if (! $userProject) {
                return back()->with('error', 'Vous n\'êtes assigné à aucun chantier. Contactez l\'administrateur.');
            }
            $validated['storekeeper_id'] = $user->id;
            $validated['project_id'] = $userProject->id;
        } elseif ($user->role === UserRole::Manager) {
            $project = Project::findOrFail($validated['project_id']);
            if (! $project->storekeeper_id) {
                return back()->withErrors([
                    'project_id' => 'Ce chantier n\'a pas encore de magasinier responsable. Affectez un magasinier sur la fiche du chantier (ou via l\'ingénieur), puis créez le matériau.',
                ]);
            }
            $validated['storekeeper_id'] = $project->storekeeper_id;
        }

        $material = Material::create($validated);

        return redirect()->route('materials.index')->with('success', 'Matériau créé avec succès');
    }

    public function update(Request $request, Material $material)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut modifier des matériaux');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'type' => 'required|in:materiel,materiaux',
            'category' => 'nullable|string|max:255',
        ]);

        $material->update($validated);

        return redirect()->route('materials.index')->with('success', 'Matériau mis à jour avec succès');
    }

    public function destroy(Material $material)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut supprimer des matériaux');
        }

        $material->delete();

        return redirect()->route('materials.index')->with('success', 'Matériau supprimé avec succès');
    }

    public function allocate(Request $request)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut affecter des matériaux');
        }

        $validated = $request->validate([
            'material_id' => 'required|exists:materials,id',
            'project_id' => 'required|exists:projects,id',
            'quantity_requested' => 'required|numeric|min:0.01',
            'comment' => 'nullable|string|max:500',
        ]);

        $user = auth()->user();

        if ($user->role === UserRole::Magasinier) {
            $managedProjectId = Project::where('storekeeper_id', $user->id)->value('id');
            if (! $managedProjectId || (int) $validated['project_id'] !== (int) $managedProjectId) {
                abort(403, 'Le magasinier ne peut affecter du matériel qu\'à son chantier.');
            }
        }

        // Check stock availability
        $material = Material::findOrFail($validated['material_id']);
        if ((int) $material->project_id !== (int) $validated['project_id']) {
            return back()->with('error', 'Le matériel sélectionné n\'appartient pas au chantier choisi.');
        }

        $project = Project::findOrFail($validated['project_id']);
        if (! $project->storekeeper_id) {
            return back()->withErrors([
                'project_id' => 'Ce chantier n\'a pas de magasinier responsable : complétez l\'affectation du magasinier avant d\'allouer du stock.',
            ]);
        }
        if ((float) $material->quantity_in_stock < (float) $validated['quantity_requested']) {
            return back()->with('error', 'La quantité demandée ('.$validated['quantity_requested'].') dépasse le stock disponible ('.$material->quantity_in_stock.').');
        }

        $allocation = ResourceRequest::create([
            'material_id' => $validated['material_id'],
            'project_id' => $validated['project_id'],
            'user_id' => auth()->id(),
            'quantity_requested' => $validated['quantity_requested'],
            'status' => 'livre',
            'comment' => $validated['comment'] ?? null,
        ]);

        // Update material stock
        if ($material) {
            $material->decrement('quantity_in_stock', $validated['quantity_requested']);

            MaterialMovement::create([
                'material_id' => $material->id,
                'user_id' => auth()->id(),
                'movement_type' => 'exit',
                'quantity' => $validated['quantity_requested'],
                'reason' => 'allocation',
                'comment' => $validated['comment'] ?? 'Affectation chantier',
                'occurred_at' => now(),
            ]);
        }

        return redirect()->route('materials.index')->with('success', 'Matériau affecté au projet avec succès');
    }

    public function stockIn(Request $request)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut enregistrer une entrée de stock');
        }

        $validated = $request->validate([
            'material_id' => 'required|exists:materials,id',
            'quantity' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:255',
            'comment' => 'nullable|string|max:500',
        ]);

        $material = Material::findOrFail($validated['material_id']);

        if (($validated['reason'] ?? '') === 'retour_chantier' && $material->type !== 'materiel') {
            return back()->with('error', 'Seul le matériel (équipement) peut faire l\'objet d\'un retour de chantier.');
        }

        $material->increment('quantity_in_stock', $validated['quantity']);

        MaterialMovement::create([
            'material_id' => $material->id,
            'user_id' => auth()->id(),
            'movement_type' => 'entry',
            'quantity' => $validated['quantity'],
            'reason' => $validated['reason'] ?? 'restock',
            'comment' => $validated['comment'] ?? null,
            'occurred_at' => now(),
        ]);

        return redirect()->route('materials.index')->with('success', 'Entrée de stock enregistrée avec succès');
    }

    public function stockOut(Request $request)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut enregistrer une sortie de stock');
        }

        $validated = $request->validate([
            'material_id' => 'required|exists:materials,id',
            'quantity' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:255',
            'comment' => 'nullable|string|max:500',
        ]);

        $material = Material::findOrFail($validated['material_id']);

        if ((float) $material->quantity_in_stock < (float) $validated['quantity']) {
            return back()->with('error', 'La quantité demandée dépasse le stock disponible.');
        }

        $material->decrement('quantity_in_stock', $validated['quantity']);

        MaterialMovement::create([
            'material_id' => $material->id,
            'user_id' => auth()->id(),
            'movement_type' => 'exit',
            'quantity' => $validated['quantity'],
            'reason' => $validated['reason'] ?? 'manual_exit',
            'comment' => $validated['comment'] ?? null,
            'occurred_at' => now(),
        ]);

        return redirect()->route('materials.index')->with('success', 'Sortie de stock enregistrée avec succès');
    }

    public function returnMaterial(Request $request, ResourceRequest $resourceRequest)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut enregistrer un retour de matériel');
        }

        $material = $resourceRequest->material;

        if ($material->type !== 'materiel') {
            abort(403, 'Seul le matériel (équipement) peut être remis en stock après utilisation.');
        }

        // Increment stock
        $material->increment('quantity_in_stock', (float) $resourceRequest->quantity_requested);

        // Track movement
        MaterialMovement::create([
            'material_id' => $material->id,
            'user_id' => auth()->id(),
            'movement_type' => 'entry',
            'quantity' => (float) $resourceRequest->quantity_requested,
            'reason' => 'retour_chantier',
            'comment' => 'Retour du chantier : '.($resourceRequest->project->name ?? 'Inconnu'),
            'occurred_at' => now(),
        ]);

        // Mark as returned
        $resourceRequest->update(['status' => 'rendu']);

        return redirect()->route('materials.index')->with('success', 'Matériel remis en stock avec succès');
    }
}
