<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\MaterialMovement;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\ResourceRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
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

    public function index(Request $request): Response|RedirectResponse
    {
        $user = auth()->user();
        $projectFilter = $request->query('project_id') ? (int) $request->query('project_id') : null;

        if ($user->role === UserRole::Magasinier && ! $projectFilter) {
            $managedProjects = Project::query()
                ->where('storekeeper_id', $user->id)
                ->orderBy('name')
                ->get();

            if ($managedProjects->count() === 1) {
                return redirect()->route('materials.index', ['project_id' => $managedProjects->first()->id]);
            }
        }

        // Manager sees all materials (optionally filtered by project)
        if ($user->role === UserRole::Manager) {
            $materialsQuery = Material::when($projectFilter, function ($q) use ($projectFilter) {
                $q->where('project_id', $projectFilter);
            })->latest('updated_at');
        } elseif ($user->role === UserRole::Magasinier) {
            $managedProjectIds = $this->magasinierProjectIds($user);

            if ($projectFilter && ! in_array($projectFilter, $managedProjectIds, true)) {
                abort(403, 'Vous n\'avez pas accès à ce chantier.');
            }

            if ($projectFilter) {
                $materialsQuery = Material::where('project_id', $projectFilter)->latest('updated_at');
            } else {
                $materialsQuery = Material::whereRaw('0 = 1');
            }
        } else {
            // Other roles see no materials
            $materialsQuery = Material::whereRaw('0 = 1');
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

        $storekeeperAllocationGroups = $this->buildStorekeeperAllocationGroups($user, $projectFilter);

        $projects = $this->projectsForMaterialsPage($user);

        $selectedProject = null;
        if ($projectFilter) {
            $selectedProject = $projects->firstWhere('id', $projectFilter);
        }

        // Filter movements by materials the user can see
        $movementsQuery = MaterialMovement::query()
            ->with(['material:id,name,unit', 'user:id,name']);

        if ($user->role === UserRole::Magasinier) {
            $managedProjectIds = $this->magasinierProjectIds($user);
            if ($projectFilter) {
                $movementsQuery->whereIn(
                    'material_id',
                    Material::where('project_id', $projectFilter)->pluck('id'),
                );
            } elseif ($managedProjectIds !== []) {
                $movementsQuery->whereIn(
                    'material_id',
                    Material::whereIn('project_id', $managedProjectIds)->pluck('id'),
                );
            } else {
                $movementsQuery->whereRaw('0 = 1');
            }
        } elseif ($user->role === UserRole::Manager && $projectFilter) {
            $movementsQuery->whereIn(
                'material_id',
                Material::where('project_id', $projectFilter)->pluck('id'),
            );
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
            'selectedProjectId' => $projectFilter,
            'selectedProjectName' => $selectedProject['name'] ?? null,
        ]);
    }

    /**
     * @return list<int>
     */
    private function magasinierProjectIds(User $user): array
    {
        return Project::query()
            ->where('storekeeper_id', $user->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function assertMagasinierOwnsProject(User $user, int $projectId): void
    {
        if (! in_array($projectId, $this->magasinierProjectIds($user), true)) {
            abort(403, 'Vous n\'avez pas accès à ce chantier.');
        }
    }

    private function authorizeMaterialAccess(User $user, Material $material): void
    {
        if ($user->role === UserRole::Manager) {
            return;
        }

        if ($user->role === UserRole::Magasinier) {
            $this->assertMagasinierOwnsProject($user, (int) $material->project_id);

            return;
        }

        abort(403);
    }

    private function materialsIndexRedirect(?int $projectId = null, ?string $success = null): RedirectResponse
    {
        $params = ($projectId !== null && $projectId > 0) ? ['project_id' => $projectId] : [];

        $redirect = redirect()->route('materials.index', $params);

        if ($success !== null) {
            $redirect->with('success', $success);
        }

        return $redirect;
    }

    /**
     * @return Collection<int, array{id: int, name: string, storekeeper_id: int|null, storekeeper_name: string|null}>
     */
    private function projectsForMaterialsPage(User $user): Collection
    {
        $query = Project::query()
            ->with([
                'storekeeper:id,name',
                'steps' => fn ($q) => $q->select('id', 'project_id', 'name', 'order')->orderBy('order'),
            ])
            ->withCount('materials')
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
            'materials_count' => (int) $project->materials_count,
            'steps' => $project->steps->map(fn (ProjectStep $step) => [
                'id' => $step->id,
                'name' => $step->name,
            ])->values()->all(),
        ]);
    }

    /**
     * @return list<array{storekeeper_id: int|null, storekeeper_name: string, storekeeper_email: string|null, projects: list<array<string, mixed>>}>
     */
    private function buildStorekeeperAllocationGroups(User $user, ?int $projectFilter = null): array
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
            $query->whereHas('project', function ($q) use ($user, $projectFilter) {
                $q->where('storekeeper_id', $user->id);
                if ($projectFilter) {
                    $q->where('id', $projectFilter);
                }
            });
        } elseif ($projectFilter) {
            $query->where('project_id', $projectFilter);
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
            'project_step_id' => 'required|exists:project_steps,id',
        ];

        if ($user->role === UserRole::Manager) {
            $rules['project_id'] = 'required|exists:projects,id';
        } elseif ($user->role === UserRole::Magasinier) {
            $rules['project_id'] = 'required|exists:projects,id';
        } else {
            $rules['project_id'] = 'nullable|exists:projects,id';
        }

        $validated = $request->validate($rules);

        if ($user->role === UserRole::Magasinier) {
            $projectId = (int) $validated['project_id'];
            $this->assertMagasinierOwnsProject($user, $projectId);
            $validated['storekeeper_id'] = $user->id;
            $validated['project_id'] = $projectId;
        } elseif ($user->role === UserRole::Manager) {
            $project = Project::findOrFail($validated['project_id']);
            if (! $project->storekeeper_id) {
                return back()->withErrors([
                    'project_id' => 'Ce chantier n\'a pas encore de magasinier responsable. Affectez un magasinier sur la fiche du chantier (ou via l\'ingénieur), puis créez le matériau.',
                ]);
            }
            $validated['storekeeper_id'] = $project->storekeeper_id;
        }

        $step = ProjectStep::query()->findOrFail($validated['project_step_id']);

        if ((int) $step->project_id !== (int) $validated['project_id']) {
            return back()->withErrors([
                'project_step_id' => 'L\'étape sélectionnée n\'appartient pas à ce chantier.',
            ]);
        }

        if ($user->role === UserRole::Magasinier && ! ProjectStep::query()
            ->where('id', $step->id)
            ->where('project_id', $validated['project_id'])
            ->exists()) {
            abort(403, 'Étape invalide pour votre chantier.');
        }

        $material = Material::create($validated);

        return $this->materialsIndexRedirect(
            (int) $validated['project_id'],
            'Matériau créé avec succès',
        );
    }

    public function update(Request $request, Material $material)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut modifier des matériaux');
        }

        $this->authorizeMaterialAccess(auth()->user(), $material);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'type' => 'required|in:materiel,materiaux',
            'category' => 'nullable|string|max:255',
        ]);

        $material->update($validated);

        return $this->materialsIndexRedirect(
            (int) $material->project_id,
            'Matériau mis à jour avec succès',
        );
    }

    public function destroy(Material $material)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut supprimer des matériaux');
        }

        $this->authorizeMaterialAccess(auth()->user(), $material);

        $projectId = (int) $material->project_id;
        $material->delete();

        return $this->materialsIndexRedirect($projectId, 'Matériau supprimé avec succès');
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
            $this->assertMagasinierOwnsProject($user, (int) $validated['project_id']);
        }

        // Check stock availability
        $material = Material::findOrFail($validated['material_id']);
        $this->authorizeMaterialAccess($user, $material);
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

        return $this->materialsIndexRedirect(
            (int) $validated['project_id'],
            'Matériau affecté au projet avec succès',
        );
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
        $this->authorizeMaterialAccess(auth()->user(), $material);

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

        return $this->materialsIndexRedirect(
            (int) $material->project_id,
            'Entrée de stock enregistrée avec succès',
        );
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
        $this->authorizeMaterialAccess(auth()->user(), $material);

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

        return $this->materialsIndexRedirect(
            (int) $material->project_id,
            'Sortie de stock enregistrée avec succès',
        );
    }

    public function returnMaterial(Request $request, ResourceRequest $resourceRequest)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut enregistrer un retour de matériel');
        }

        $material = $resourceRequest->material;
        $this->authorizeMaterialAccess(auth()->user(), $material);

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

        return $this->materialsIndexRedirect(
            (int) $material->project_id,
            'Matériel remis en stock avec succès',
        );
    }
}
