<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    /**
     * Run the database seeds with hierarchy:
     * Manager > ChefChantier > Engineer on projects
     */
    public function run(): void
    {
        $manager = User::where('role', UserRole::Manager)->first();
        $engineers = User::where('role', UserRole::Engineer)->get();
        $chefChantiers = User::where('role', UserRole::ChefChantier)->get();
        $magasiniers = User::where('role', UserRole::Magasinier)->get();

        $projects = [
            [
                'name' => 'Résidence Horizon',
                'description' => 'Construction d\'un complexe résidentiel de 20 appartements.',
                'budget' => 250000.00,
                'deadline' => now()->addMonths(6),
                'status' => 'en_cours',
            ],
            [
                'name' => 'Centre Commercial Rivoli',
                'description' => 'Réhabilitation complète du centre commercial.',
                'budget' => 450000.00,
                'deadline' => now()->addMonths(12),
                'status' => 'initialisation',
            ],
            [
                'name' => 'Pont Kabila',
                'description' => 'Construction d\'un pont routier.',
                'budget' => 850000.00,
                'deadline' => now()->addMonths(18),
                'status' => 'en_cours',
            ],
            [
                'name' => 'Hôtel Étoile',
                'description' => 'Construction d\'un hôtel 4 étoiles.',
                'budget' => 1200000.00,
                'deadline' => now()->addMonths(24),
                'status' => 'initialisation',
            ],
        ];

        foreach ($projects as $index => $projectData) {
            $engineer = $engineers[$index % $engineers->count()];
            $chefChantier = $chefChantiers
                ->firstWhere('engineer_id', $engineer->id)
                ?? $chefChantiers[$index % $chefChantiers->count()];
            $magasinier = $magasiniers[$index % $magasiniers->count()];

            $project = Project::create([
                ...$projectData,
                'manager_id' => $manager->id,
                'engineer_id' => $engineer->id,
                'chef_chantier_id' => $chefChantier->id,
                'storekeeper_id' => $magasinier->id,
                'start_date' => now(),
            ]);

            // Liaison automatique de l'équipe ouvrière du Chef de Chantier au projet
            $teamIds = $chefChantier->team()->pluck('id')->toArray();
            if (! empty($teamIds)) {
                $project->workers()->sync($teamIds);
            }
        }
    }
}
