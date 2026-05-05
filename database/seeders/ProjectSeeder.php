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
        $chefChantiers = User::where('role', UserRole::ChefChantier)->get();
        $engineers = User::where('role', UserRole::Engineer)->get();

        // Get engineers grouped by their chef_chantier
        $engineersByChef = [];
        foreach ($chefChantiers as $chef) {
            $engineersByChef[$chef->id] = $engineers->where('chef_chantier_id', $chef->id);
        }

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
                'status' => 'planifie',
            ],
            [
                'name' => 'Hôtel Étoile',
                'description' => 'Construction d\'un hôtel 4 étoiles.',
                'budget' => 1200000.00,
                'deadline' => now()->addMonths(24),
                'status' => 'initialisation',
            ],
            [
                'name' => 'École Technique',
                'description' => 'Construction d\'un centre de formation technique.',
                'budget' => 180000.00,
                'deadline' => now()->addMonths(8),
                'status' => 'en_cours',
            ],
        ];

        $projectIndex = 0;
        foreach ($chefChantiers as $chefChantier) {
            $chefEngineers = $engineersByChef[$chefChantier->id] ?? collect();

            foreach ($chefEngineers as $engineer) {
                if ($projectIndex >= count($projects)) {
                    break 2;
                }

                $projectData = $projects[$projectIndex];
                $project = Project::create([
                    ...$projectData,
                    'manager_id' => $manager->id,
                    'engineer_id' => $engineer->id,
                ]);

                // Auto-assign engineer's team to project (workers)
                $teamIds = $engineer->team()->pluck('id')->toArray();
                if (! empty($teamIds)) {
                    $project->workers()->sync($teamIds);
                }

                $projectIndex++;
            }
        }
    }
}
