<?php

use App\Enums\UserRole;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('manager dashboard exposes project deadline alerts', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'start_date' => now()->subMonth(),
        'deadline' => now()->subDays(3),
        'status' => 'en_cours',
    ]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'start_date' => now()->toDateString(),
        'deadline' => now()->addDays(7),
        'status' => 'en_cours',
    ]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'start_date' => now()->toDateString(),
        'deadline' => now()->addMonths(4),
        'status' => 'en_cours',
    ]);

    $this->actingAs($manager)->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('projectDeadlineAlerts.overdue', 1)
            ->has('projectDeadlineAlerts.ending_soon', 1)
            ->has('deadlineNotifications')
            ->where('deadlineNotifications.unread_count', fn ($c) => (int) $c >= 1)
        );
});

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('engineer dashboard does not expose budget visibility flag', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);

    $this->actingAs($engineer)
        ->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('canViewBudget', false)
        );
});

test('chef de chantier dashboard does not expose budget visibility flag', function () {
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);

    $this->actingAs($chef)
        ->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('canViewBudget', false)
        );
});

test('engineer dashboard includes attendance management props', function () {
    $engineer = User::factory()->create(['role' => 'engineer']);
    $magasinier = User::factory()->create(['role' => 'magasinier']);
    Project::factory()->create(['engineer_id' => $engineer->id]);

    $this->actingAs($engineer);

    $this->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('attendanceProjects')
            ->has('attendanceWorkers')
            ->where('attendanceWorkers.0.id', $magasinier->id)
            ->has('attendanceStatuses')
            ->has('attendanceDate')
            ->has('receivedWorkerIncidents')
            ->where('canResolveWorkerIncidents', true)
        );
});

test('engineer dashboard lists worker incidents for engineer projects', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache test',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Risque sur chantier',
            'details' => 'Description detaillee du probleme observe sur le chantier.',
            'severity' => 'eleve',
        ])
        ->assertOk();

    $this->actingAs($engineer)
        ->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('receivedWorkerIncidents', 1)
            ->where('canResolveWorkerIncidents', true)
        );
});

test('worker dashboard includes attendance tracking props', function () {
    $worker = User::factory()->create(['role' => 'worker']);
    $project = Project::factory()->create();

    Attendance::factory()->create([
        'user_id' => $worker->id,
        'project_id' => $project->id,
        'date' => now()->toDateString(),
        'status' => 'present',
    ]);

    $this->actingAs($worker);

    $this->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('workerAttendances')
            ->has('workerAttendanceSummary')
        );
});

test('chef chantier dashboard includes attendance management props', function () {
    $engineer = User::factory()->create(['role' => 'engineer']);
    $chef = User::factory()->create([
        'role' => 'chef_chantier',
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => 'worker',
        'chef_chantier_id' => $chef->id,
    ]);
    Project::factory()->create([
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);

    $this->actingAs($chef);

    $this->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('attendanceProjects')
            ->has('attendanceWorkers')
            ->where('attendanceWorkers.0.id', $worker->id)
            ->has('receivedWorkerIncidents')
            ->where('canResolveWorkerIncidents', true)
        );
});
