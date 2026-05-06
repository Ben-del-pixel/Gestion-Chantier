<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class AttendanceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $projects = \App\Models\Project::with('workers')->get();

        foreach ($projects as $project) {
            foreach ($project->workers as $worker) {
                // Créer des présences pour les 7 derniers jours
                for ($i = 0; $i < 7; $i++) {
                    \App\Models\Attendance::create([
                        'user_id' => $worker->id,
                        'project_id' => $project->id,
                        'date' => now()->subDays($i)->format('Y-m-d'),
                        'status' => 'present',
                    ]);
                }
            }
        }
    }
}
