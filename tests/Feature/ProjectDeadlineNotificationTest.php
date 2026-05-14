<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\DB;

it('creates database notifications for manager engineer and chef when project is ending soon', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);

    Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
        'start_date' => now()->subWeek(),
        'deadline' => now()->addDays(5),
        'status' => 'en_cours',
    ]);

    expect(DB::table('notifications')->count())->toBe(0);

    $this->actingAs($manager)->get(route('dashboard'))->assertSuccessful();

    expect(DB::table('notifications')->count())->toBe(3);

    $this->actingAs($manager)->get(route('dashboard'))->assertSuccessful();

    expect(DB::table('notifications')->count())->toBe(3);
});

it('manager can mark deadline notification as read', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);

    Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
        'start_date' => now()->subWeek(),
        'deadline' => now()->addDays(3),
        'status' => 'en_cours',
    ]);

    $this->actingAs($manager)->get(route('dashboard'))->assertSuccessful();

    $notification = $manager->unreadNotifications()->first();
    expect($notification)->not->toBeNull();

    $this->actingAs($manager)
        ->post(route('notifications.read', ['notification' => $notification->id]))
        ->assertRedirect();

    expect($notification->fresh()->read_at)->not->toBeNull();
});

it('returns 404 when marking another users notification as read', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $other = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $other->id,
    ]);

    Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $other->id,
        'chef_chantier_id' => $chef->id,
        'start_date' => now()->subWeek(),
        'deadline' => now()->addDays(2),
        'status' => 'en_cours',
    ]);

    $this->actingAs($manager)->get(route('dashboard'))->assertSuccessful();

    $notification = $manager->unreadNotifications()->first();
    expect($notification)->not->toBeNull();

    $this->actingAs($other)
        ->post(route('notifications.read', ['notification' => $notification->id]))
        ->assertNotFound();
});
