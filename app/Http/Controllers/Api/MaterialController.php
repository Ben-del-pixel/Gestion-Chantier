<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Material;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MaterialController extends Controller
{
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

        return Inertia::render('materials/index', [
            'materials' => $materials,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'quantity_in_stock' => 'required|numeric|min:0',
            'unit' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
        ]);

        $material = Material::create($validated);

        return response()->json([
            'material' => $material,
            'message' => 'Matériau créé avec succès',
        ], 201);
    }
}
