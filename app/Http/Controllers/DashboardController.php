<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $data = [
            'projects' => [],
            'stats' => [
                'total_budget' => 0,
                'active_projects' => 0,
                'total_workers' => 0,
                'total_tasks' => 0,
            ],
            'tasks' => [],
        ];

        if ($user->role === UserRole::Manager) {
            $data['projects'] = Project::with(['engineer', 'steps'])->latest()->get();
            $data['stats'] = [
                'total_budget' => Project::sum('budget'),
                'active_projects' => Project::where('status', 'en_cours')->count(),
                'total_workers' => User::where('role', UserRole::Worker)->count(),
                'total_tasks' => Task::count(),
            ];
            $data['engineers'] = User::where('role', UserRole::Engineer)->get(['id', 'name', 'email']);
        } elseif ($user->role === UserRole::Engineer) {
            $data['tasks'] = Task::whereHas('project', function ($q) use ($user) {
                $q->where('engineer_id', $user->id);
            })->with(['workers', 'project'])->latest()->get();
            
            $data['stats'] = [
                'active_tasks' => Task::whereHas('project', function ($q) use ($user) {
                    $q->where('engineer_id', $user->id);
                })->where('status', 'en_cours')->count(),
                'total_workers_under' => User::whereHas('tasks', function($q) use ($user) {
                    $q->whereHas('project', function($pq) use ($user) {
                        $pq->where('engineer_id', $user->id);
                    });
                })->distinct()->count(),
            ];
        } elseif ($user->role === UserRole::Worker) {
            $data['tasks'] = $user->tasks()->with('project')->latest()->get();
        }

        return Inertia::render('dashboard', $data);
    }
}
