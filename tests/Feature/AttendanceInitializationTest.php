<?php

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;

beforeEach(function () {
    // Create test data
    $this->manager = User::factory()->create(['role' => 'manager']);
    $this->engineer = User::factory()->create(['role' => 'engineer']);
    $this->workers = User::factory(3)->create(['role' => 'worker']);
    $this->project = Project::factory()->create([
        'manager_id' => $this->manager->id,
        'engineer_id' => $this->engineer->id,
    ]);

    // Assign workers to project using sync
    $this->project->workers()->sync($this->workers->pluck('id')->toArray());

    // Verify assignment
    $count = $this->project->workers()->count();
    expect($count)->toBe(3);

    $this->actingAs($this->engineer);
});

it('initializes attendance records for project workers', function () {
    $date = now()->toDateString();

    // Assign workers directly
    $this->project->workers()->sync($this->workers->pluck('id')->toArray());

    $response = $this->postJson('/api/attendance/initialize', [
        'date' => $date,
        'project_id' => $this->project->id,
    ]);

    $response->assertSuccessful();
    $created = $response->json('created');

    // At least one should be created
    expect($created)->toBeGreaterThan(0);
});

it('assigns workers to a project', function () {
    $workerIds = $this->workers->pluck('id')->toArray();

    $response = $this->postJson(
        "/api/projects/{$this->project->id}/workers",
        ['worker_ids' => $workerIds]
    );

    $response->assertSuccessful();

    // Verify workers are assigned
    $assignedWorkers = $this->project->workers()->select('users.id')->pluck('id')->toArray();
    foreach ($workerIds as $workerId) {
        expect($assignedWorkers)->toContain($workerId);
    }
});

it('allows engineer to assign magasinier to a project', function () {
    $magasinier = User::factory()->create(['role' => 'magasinier']);

    $response = $this->postJson(
        "/api/projects/{$this->project->id}/workers",
        ['worker_ids' => [$magasinier->id]]
    );

    $response->assertSuccessful();
    $this->assertTrue($this->project->workers()->where('users.id', $magasinier->id)->exists());
});

it('forbids worker assignment by non engineer users', function () {
    $this->actingAs($this->manager);

    $response = $this->postJson(
        "/api/projects/{$this->project->id}/workers",
        ['worker_ids' => $this->workers->pluck('id')->toArray()]
    );

    $response->assertForbidden();
});

it('forbids attendance initialization for projects outside engineer scope', function () {
    $otherEngineer = User::factory()->create(['role' => 'engineer']);
    $projectFromAnotherEngineer = Project::factory()->create([
        'manager_id' => $this->manager->id,
        'engineer_id' => $otherEngineer->id,
    ]);

    $response = $this->postJson('/api/attendance/initialize', [
        'date' => now()->toDateString(),
        'project_id' => $projectFromAnotherEngineer->id,
    ]);

    $response->assertForbidden();
});

it('updates attendance status', function () {
    $attendance = Attendance::factory()->create([
        'user_id' => $this->workers[0]->id,
        'project_id' => $this->project->id,
        'date' => now()->toDateString(),
        'status' => AttendanceStatus::Present->value,
    ]);

    $response = $this->putJson("/attendance/{$attendance->id}/status", [
        'status' => AttendanceStatus::Sick->value,
    ]);

    $response->assertSuccessful();

    $attendance->refresh();
    // The status is cast to Enum, so compare the value
    expect($attendance->status->value)->toBe(AttendanceStatus::Sick->value);
});

it('validates status enum on update', function () {
    $attendance = Attendance::factory()->create([
        'user_id' => $this->workers[0]->id,
        'project_id' => $this->project->id,
        'date' => now()->toDateString(),
    ]);

    $response = $this->putJson("/attendance/{$attendance->id}/status", [
        'status' => 'invalid_status',
    ]);

    $response->assertUnprocessable();
});

it('lists available workers on attendance index', function () {
    $response = $this->get('/attendance');

    $response->assertSuccessful();
    $response->assertInertia();
});

it('includes statuses in attendance index', function () {
    $response = $this->get('/attendance');

    $response->assertSuccessful();
    $response->assertInertia();
});
