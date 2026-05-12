<?php

use App\Enums\UserRole;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('engineer cannot manage attendance', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer->value]);
    $worker = User::factory()->create(['role' => UserRole::Worker->value]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
    ]);

    $this->actingAs($engineer)
        ->post(route('attendance.check-in'), [
            'user_id' => $worker->id,
            'project_id' => $project->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertForbidden();
});

test('engineer can view attendance page in read only mode', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer->value]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
    ]);

    $this->actingAs($engineer)
        ->get(route('attendance.index'))
        ->assertOk();
});

test('worker can view attendance page in read only mode', function () {
    $worker = User::factory()->create(['role' => UserRole::Worker->value]);
    $project = Project::factory()->create();
    $task = Task::create([
        'project_id' => $project->id,
        'project_step_id' => null,
        'project_sub_step_id' => null,
        'name' => 'Tâche ouvrier',
        'description' => 'Test tâche',
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->sync([$worker->id]);

    $this->actingAs($worker)
        ->get(route('attendance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('assignedTasks', 1)
            ->where('assignedTasks.0.name', 'Tâche ouvrier')
        );
});

test('assigned magasinier can manage attendance for own project only', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier->value]);
    $otherMagasinier = User::factory()->create(['role' => UserRole::Magasinier->value]);
    $worker = User::factory()->create(['role' => UserRole::Worker->value]);

    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'storekeeper_id' => $magasinier->id,
    ]);
    $project->workers()->sync([$worker->id]);

    $otherProject = Project::factory()->create([
        'manager_id' => $manager->id,
        'storekeeper_id' => $otherMagasinier->id,
    ]);

    $this->actingAs($magasinier)
        ->post(route('attendance.check-in'), [
            'user_id' => $worker->id,
            'project_id' => $project->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertRedirect();

    $this->actingAs($magasinier)
        ->post(route('attendance.check-in'), [
            'user_id' => $worker->id,
            'project_id' => $otherProject->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertForbidden();
});

test('magasinier can check in only worker or chef chantier of own project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier->value]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier->value]);
    $worker = User::factory()->create(['role' => UserRole::Worker->value]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer->value]);

    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'storekeeper_id' => $magasinier->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $project->workers()->sync([$worker->id]);

    $this->actingAs($magasinier)
        ->post(route('attendance.check-in'), [
            'user_id' => $worker->id,
            'project_id' => $project->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertRedirect();

    $this->actingAs($magasinier)
        ->post(route('attendance.check-in'), [
            'user_id' => $chef->id,
            'project_id' => $project->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertRedirect();

    $this->actingAs($magasinier)
        ->post(route('attendance.check-in'), [
            'user_id' => $engineer->id,
            'project_id' => $project->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertForbidden();
});

test('chef chantier can view attendance index in read only mode', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier->value]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);

    $this->actingAs($chef)
        ->get(route('attendance.index'))
        ->assertOk();
});

test('chef chantier cannot check in workers', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier->value]);
    $worker = User::factory()->create(['role' => UserRole::Worker->value]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $project->workers()->sync([$worker->id]);

    $this->actingAs($chef)
        ->post(route('attendance.check-in'), [
            'user_id' => $worker->id,
            'project_id' => $project->id,
            'shift' => 'morning',
            'status' => 'present',
        ])
        ->assertForbidden();
});

test('chef chantier api list rejects project they do not lead', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier->value]);
    $myProject = Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $otherProject = Project::factory()->create([
        'manager_id' => $manager->id,
    ]);

    $this->actingAs($chef)
        ->getJson('/api/attendance/list?project_id='.$otherProject->id.'&date='.now()->toDateString())
        ->assertForbidden();

    $this->actingAs($chef)
        ->getJson('/api/attendance/list?project_id='.$myProject->id.'&date='.now()->toDateString())
        ->assertOk();
});

test('manager can update attendance status', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $worker = User::factory()->create(['role' => UserRole::Worker->value]);
    $project = Project::factory()->create(['manager_id' => $manager->id]);
    $attendance = Attendance::factory()->create([
        'user_id' => $worker->id,
        'project_id' => $project->id,
        'status' => 'present',
    ]);

    $this->actingAs($manager)
        ->put(route('attendance.update-status', ['attendance' => $attendance->id]), [
            'status' => 'retard',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('attendances', [
        'id' => $attendance->id,
        'status' => 'retard',
    ]);
});
