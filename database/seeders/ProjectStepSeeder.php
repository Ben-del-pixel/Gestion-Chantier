<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\ProjectSubStep;
use Illuminate\Database\Seeder;

class ProjectStepSeeder extends Seeder
{
    public function run(): void
    {
        $projects = Project::all();

        $stepsData = [
            ['name' => 'Préparation du terrain', 'budget' => 5000],
            ['name' => 'Fondations', 'budget' => 15000],
            ['name' => 'Gros œuvre', 'budget' => 50000],
            ['name' => 'Toiture', 'budget' => 20000],
            ['name' => 'Finitions', 'budget' => 10000],
        ];

        foreach ($projects as $project) {
            foreach ($stepsData as $index => $data) {
                $step = $project->steps()->create([
                    'name' => $data['name'],
                    'budget' => $data['budget'],
                    'order' => $index + 1,
                    'is_completed' => false,
                ]);

                // Create sub-steps for each step
                for ($i = 1; $i <= 3; $i++) {
                    $subStep = ProjectSubStep::create([
                        'project_step_id' => $step->id,
                        'name' => "Sous-étape {$i} de {$step->name}",
                        'description' => "Description détaillée de la sous-étape {$i}",
                        'chef_chantier_id' => $project->chef_chantier_id,
                        'planned_date' => now()->addDays($index * 5 + $i),
                        'status' => 'pending',
                    ]);

                    // Assign 1-2 workers from the project to this sub-step
                    $projectWorkers = $project->workers()->inRandomOrder()->take(rand(1, 2))->get();
                    foreach ($projectWorkers as $worker) {
                        $subStep->workers()->attach($worker->id, [
                            'is_completed' => false,
                        ]);
                    }
                }
            }

            // Sync project budget based on steps
            $project->syncBudgetFromSteps();
        }
    }
}
