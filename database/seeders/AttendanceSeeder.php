<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Project;
use Illuminate\Database\Seeder;

class AttendanceSeeder extends Seeder
{
    /**
     * Présences fictives sur les derniers jours pour chaque ouvrier affecté à un chantier.
     */
    public function run(): void
    {
        $projects = Project::with('workers')->get();

        foreach ($projects as $project) {
            foreach ($project->workers as $worker) {
                // Créer des présences pour les 7 derniers jours
                for ($i = 0; $i < 7; $i++) {
                    $date = now()->subDays($i)->startOfDay();
                    $checkIn = $date->copy()->setTime(8, rand(0, 25));
                    $checkOut = $date->copy()->setTime(17, rand(0, 45));

                    Attendance::create([
                        'user_id' => $worker->id,
                        'project_id' => $project->id,
                        'date' => $date->format('Y-m-d'),
                        'status' => 'present',
                        'shift' => 'morning',
                        'check_in' => $checkIn,
                        'check_out' => $checkOut,
                    ]);
                }
            }
        }
    }
}
