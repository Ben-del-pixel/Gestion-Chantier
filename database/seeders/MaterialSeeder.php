<?php

namespace Database\Seeders;

use App\Models\Material;
use App\Models\Project;
use Illuminate\Database\Seeder;

class MaterialSeeder extends Seeder
{
    /**
     * Matériaux et matériel de chantier (libellés en français).
     */
    public function run(): void
    {
        $projects = Project::all();

        $materialTemplates = [
            // Consumables (materiaux)
            [
                'name' => 'Ciment',
                'description' => 'Ciment Portland 42.5',
                'quantity_in_stock' => 500,
                'unit' => 'sacs',
                'type' => 'materiaux',
                'category' => 'Gros Œuvre',
            ],
            [
                'name' => 'Sable',
                'description' => 'Sable de rivière lavé',
                'quantity_in_stock' => 20,
                'unit' => 'm3',
                'type' => 'materiaux',
                'category' => 'Gros Œuvre',
            ],
            [
                'name' => 'Carrelage 60x60',
                'description' => 'Grès cérame poli',
                'quantity_in_stock' => 150,
                'unit' => 'm2',
                'type' => 'materiaux',
                'category' => 'Second Œuvre',
            ],

            // Equipment (materiel)
            [
                'name' => 'Marteau Piqueur',
                'description' => 'Bosch GSH 11 E Professional',
                'quantity_in_stock' => 5,
                'unit' => 'unité',
                'type' => 'materiel',
                'category' => 'Outillage Électroportatif',
            ],
            [
                'name' => 'Bétonnière 350L',
                'description' => 'Moteur thermique GX160',
                'quantity_in_stock' => 2,
                'unit' => 'unité',
                'type' => 'materiel',
                'category' => 'Matériel de Chantier',
            ],
        ];

        foreach ($projects as $project) {
            foreach ($materialTemplates as $template) {
                Material::create([
                    ...$template,
                    'name' => $template['name'].' - '.$project->name,
                    'project_id' => $project->id,
                    'storekeeper_id' => $project->storekeeper_id,
                ]);
            }
        }
    }
}
