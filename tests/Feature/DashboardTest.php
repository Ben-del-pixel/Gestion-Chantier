<?php

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

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

test('engineer dashboard includes attendance management props', function () {
    $engineer = User::factory()->create(['role' => 'engineer']);
    Project::factory()->create(['engineer_id' => $engineer->id]);

    $this->actingAs($engineer);

    $this->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('attendanceProjects')
            ->has('attendanceWorkers')
            ->has('attendanceStatuses')
            ->has('attendanceShifts')
            ->has('attendanceDate')
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
