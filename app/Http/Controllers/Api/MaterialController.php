<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\MaterialMovement;
use App\Models\Project;
use App\Models\ResourceRequest;
use Illuminate\Http\Request;
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

    public function index(): Response
    {
        $materials = Material::query()
            ->select(['id', 'name', 'description', 'quantity_in_stock', 'unit', 'type', 'category', 'updated_at'])
            ->latest('updated_at')
            ->get()
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

        $projectAllocations = ResourceRequest::where('status', 'livre')
            ->with(['project:id,name', 'material:id,name,unit'])
            ->get()
            ->groupBy('project_id')
            ->map(function ($items) {
                $project = $items->first()->project;

                return [
                    'project_id' => $project->id,
                    'project_name' => $project->name,
                    'materials' => $items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'material_id' => $item->material_id,
                            'name' => $item->material?->name,
                            'quantity' => (float) $item->quantity_requested,
                            'unit' => $item->material?->unit,
                            'type' => $item->material?->type,
                        ];
                    })->values(),
                ];
            })->values();

        $projects = Project::select('id', 'name')->latest()->get();

        $movements = MaterialMovement::query()
            ->with(['material:id,name,unit', 'user:id,name'])
            ->latest('occurred_at')
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
            'projectAllocations' => $projectAllocations,
            'projects' => $projects,
            'movements' => $movements,
        ]);
    }

    public function store(Request $request)
    {
        if (! $this->canManageMaterials()) {
            abort(403, 'Seul un magasinier ou manager peut créer des matériaux');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'type' => 'required|in:materiel,materiaux',
            'category' => 'nullable|string|max:255',
        ]);

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

        $allocation = ResourceRequest::create([
            'material_id' => $validated['material_id'],
            'project_id' => $validated['project_id'],
            'user_id' => auth()->id(),
            'quantity_requested' => $validated['quantity_requested'],
            'status' => 'livre',
            'comment' => $validated['comment'] ?? null,
        ]);

        // Update material stock
        $material = Material::find($validated['material_id']);
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
            return back()->withErrors([
                'reason' => 'Seul le matériel (équipement) peut faire l\'objet d\'un retour de chantier.',
            ]);
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
            return back()->withErrors([
                'quantity' => 'La quantité demandée dépasse le stock disponible.',
            ]);
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
