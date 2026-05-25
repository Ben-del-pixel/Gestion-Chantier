<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('manager can create chef de chantier with initial team', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $w1 = User::factory()->create(['role' => UserRole::Worker, 'chef_chantier_id' => null]);
    $w2 = User::factory()->create(['role' => UserRole::Worker, 'chef_chantier_id' => null]);

    $this->actingAs($manager)->post(route('users.store'), [
        'name' => 'Chef Test',
        'email' => 'chef-test-team@example.com',
        'password' => 'password123',
        'role' => UserRole::ChefChantier->value,
        'phone' => '0990000001',
        'engineer_id' => $engineer->id,
        'team_worker_ids' => [$w1->id, $w2->id],
    ])->assertRedirect();

    $chef = User::where('email', 'chef-test-team@example.com')->firstOrFail();
    expect($chef->engineer_id)->toBe($engineer->id);

    $w1->refresh();
    $w2->refresh();
    expect($w1->chef_chantier_id)->toBe($chef->id);
    expect($w2->chef_chantier_id)->toBe($chef->id);
});

test('manager can sync chef team via update', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $w1 = User::factory()->create(['role' => UserRole::Worker, 'chef_chantier_id' => $chef->id]);
    $w2 = User::factory()->create(['role' => UserRole::Worker, 'chef_chantier_id' => null]);

    $this->actingAs($manager)->put(route('users.update', $chef), [
        'name' => $chef->name,
        'email' => $chef->email,
        'role' => UserRole::ChefChantier->value,
        'phone' => $chef->phone ?? '',
        'engineer_id' => $engineer->id,
        'team_worker_ids' => [$w2->id],
    ])->assertRedirect();

    $w1->refresh();
    $w2->refresh();
    expect($w1->chef_chantier_id)->toBeNull();
    expect($w2->chef_chantier_id)->toBe($chef->id);
});
