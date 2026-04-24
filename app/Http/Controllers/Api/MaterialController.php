<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\Project;
use App\Models\ResourceRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MaterialController extends Controller
{
    private function isMagasinier(): bool
    {
        return auth()->user()?->role === UserRole::Magasinier;
    }

    public function index(): Response
    {
        $materials = Material::query()
            ->select(['id', 'name', 'description', 'quantity_in_stock', 'unit', 'category', 'updated_at'])
            ->latest('updated_at')
            ->get();

        if ($materials->isEmpty()) {
            $materials = collect([
                [
                    'id' => 1,
                    'name' => 'Ciment',
                    'description' => 'Fournisseur A',
                    'quantity_in_stock' => 500,
                    'unit' => 'sacs',
                    'category' => 'construction',
                    'updated_at' => now()->subDays(1)->toDateString(),
                ],
                [
                    'id' => 2,
                    'name' => 'Acier',
                    'description' => 'Fournisseur B',
                    'quantity_in_stock' => 150,
                    'unit' => 'tonnes',
                    'category' => 'metaux',
                    'updated_at' => now()->subDays(2)->toDateString(),
                ],
                [
                    'id' => 3,
                    'name' => 'Briques',
                    'description' => 'Fournisseur C',
                    'quantity_in_stock' => 50,
                    'unit' => 'milliers',
                    'category' => 'maconnerie',
                    'updated_at' => now()->subDays(3)->toDateString(),
                ],
                [
                    'id' => 4,
                    'name' => 'Bois',
                    'description' => 'Fournisseur A',
                    'quantity_in_stock' => 200,
                    'unit' => 'm3',
                    'category' => 'charpente',
                    'updated_at' => now()->subDays(4)->toDateString(),
                ],
            ]);
        }

        $projectAllocations = ResourceRequest::where('status', 'livre')
            ->with(['project:id,name', 'material:id,name,unit'])
            ->get()
            ->groupBy('project_id')
            ->map(function ($items) {
                $project = $items->first()->project;

                return [
                    'project_id' => $project->id,
                    'project_name' => $project->name,
                    'materials' => $items->groupBy('material_id')->map(function ($group) {
                        return [
                            'name' => $group->first()->material->name,
                            'quantity' => $group->sum('quantity_requested'),
                            'unit' => $group->first()->material->unit,
                        ];
                    })->values(),
                ];
            })->values();

        if ($projectAllocations->isEmpty()) {
            $projectAllocations = collect([
                [
                    'project_id' => 1,
                    'project_name' => 'Residence Horizon',
                    'materials' => [
                        ['name' => 'Ciment', 'quantity' => 150, 'unit' => 'sacs'],
                        ['name' => 'Acier', 'quantity' => 20, 'unit' => 'tonnes'],
                    ],
                ],
                [
                    'project_id' => 2,
                    'project_name' => 'Centre Commercial Rivoli',
                    'materials' => [
                        ['name' => 'Briques', 'quantity' => 5000, 'unit' => 'milliers'],
                        ['name' => 'Ciment', 'quantity' => 80, 'unit' => 'sacs'],
                    ],
                ],
            ]);
        }

        $projects = Project::select('id', 'name')->latest()->get();

        return Inertia::render('materials/index', [
            'materials' => $materials,
            'projectAllocations' => $projectAllocations,
            'projects' => $projects,
        ]);
    }

    public function store(Request $request)
    {
        if (! $this->isMagasinier()) {
            abort(403, 'Seul un magasinier peut créer des matériaux');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
        ]);

        $material = Material::create($validated);

        return redirect()->route('materials.index')->with('success', 'Matériau créé avec succès');
    }

    public function update(Request $request, Material $material)
    {
        if (! $this->isMagasinier()) {
            abort(403, 'Seul un magasinier peut modifier des matériaux');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
        ]);

        $material->update($validated);

        return redirect()->route('materials.index')->with('success', 'Matériau mis à jour avec succès');
    }

    public function destroy(Material $material)
    {
        if (! $this->isMagasinier()) {
            abort(403, 'Seul un magasinier peut supprimer des matériaux');
        }

        $material->delete();

        return redirect()->route('materials.index')->with('success', 'Matériau supprimé avec succès');
    }

    public function allocate(Request $request)
    {
        if (! $this->isMagasinier()) {
            abort(403, 'Seul un magasinier peut affecter des matériaux');
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
        }

        return redirect()->route('materials.index')->with('success', 'Matériau affecté au projet avec succès');
    }
}
