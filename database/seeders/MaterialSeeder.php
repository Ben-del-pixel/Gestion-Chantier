<?php

namespace Database\Seeders;

use App\Models\Material;
use Illuminate\Database\Seeder;

class MaterialSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $materials = [
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
                'unit' => 'unite',
                'type' => 'materiel',
                'category' => 'Outillage Électroportatif',
            ],
            [
                'name' => 'Bétonnière 350L',
                'description' => 'Moteur thermique GX160',
                'quantity_in_stock' => 2,
                'unit' => 'unite',
                'type' => 'materiel',
                'category' => 'Matériel de Chantier',
            ],
            [
                'name' => 'Échafaudage (Lot)',
                'description' => 'Échafaudage tubulaire complet',
                'quantity_in_stock' => 10,
                'unit' => 'lot',
                'type' => 'materiel',
                'category' => 'Équipement de travail',
            ],
        ];

        foreach ($materials as $material) {
            Material::updateOrCreate(['name' => $material['name']], $material);
        }
    }
}
