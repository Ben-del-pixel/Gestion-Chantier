<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    /**
     * Tâches d'exemple en français, liées aux étapes des chantiers.
     */
    public function run(): void
    {
        $taskTemplates = [
            ['name' => 'Implantation et piquetage', 'status' => 'termine', 'offset_start' => -14, 'duration' => 3],
            ['name' => 'Terrassement et compactage', 'status' => 'en_cours', 'offset_start' => -10, 'duration' => 5],
            ['name' => 'Coulage des fondations', 'status' => 'planifie', 'offset_start' => -4, 'duration' => 7],
            ['name' => 'Élévation des murs porteurs', 'status' => 'planifie', 'offset_start' => 4, 'duration' => 10],
        ];

        $projects = Project::with(['steps', 'workers'])->get();

        foreach ($projects as $project) {
            $steps = $project->steps->sortBy('order')->values();
            $workers = $project->workers->filter(fn ($u) => $u->role === UserRole::Worker)->values();

            if ($steps->isEmpty()) {
                continue;
            }

            foreach ($taskTemplates as $idx => $tpl) {
                $step = $steps[$idx % $steps->count()];
                $start = now()->addDays($tpl['offset_start'])->startOfDay();
                $end = (clone $start)->addDays($tpl['duration'])->endOfDay();

                $task = Task::create([
                    'project_id' => $project->id,
                    'project_step_id' => $step->id,
                    'project_sub_step_id' => null,
                    'name' => $tpl['name'].' — '.$project->name,
                    'description' => 'Tâche générée pour la démonstration du planning.',
                    'start_date' => $start,
                    'end_date' => $end,
                    'status' => $tpl['status'],
                ]);

                if ($workers->isNotEmpty()) {
                    $n = min(2, $workers->count());
                    $assign = $workers->shuffle()->take($n)->pluck('id')->all();
                    $task->workers()->sync($assign);
                }
            }

            // Une tâche transversale sans étape (pour tester l'affichage)
            $orphan = Task::create([
                'project_id' => $project->id,
                'project_step_id' => null,
                'project_sub_step_id' => null,
                'name' => 'Réunion de coordination sécurité — '.$project->name,
                'description' => 'Point hebdomadaire chantier (hors étape).',
                'start_date' => now()->startOfDay(),
                'end_date' => now()->addDay()->endOfDay(),
                'status' => 'planifie',
            ]);
            if ($workers->isNotEmpty()) {
                $orphan->workers()->sync([$workers->first()->id]);
            }
        }
    }
}
