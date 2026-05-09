<?php

use App\Enums\UserRole;
use App\Models\User;

test('chef de chantier cannot create worker', function () {
    $chef = User::factory()->create(['role' => UserRole::ChefChantier->value]);

    $this->actingAs($chef)
        ->post(route('users.store'), [
            'name' => 'Ouvrier Interdit',
            'email' => 'ouvrier-interdit@example.com',
            'password' => 'password123',
            'role' => UserRole::Worker->value,
            'chef_chantier_id' => $chef->id,
        ])
        ->assertForbidden();
});

test('chef de chantier cannot create project', function () {
    $chef = User::factory()->create(['role' => UserRole::ChefChantier->value]);

    $this->actingAs($chef)
        ->post(route('projects.store'), [
            'name' => 'Projet interdit',
            'deadline' => now()->addMonth()->toDateString(),
            'status' => 'initialisation',
        ])
        ->assertForbidden();
});

test('engineer cannot create project', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer->value]);

    $this->actingAs($engineer)
        ->post(route('projects.store'), [
            'name' => 'Projet ingénieur',
            'deadline' => now()->addMonth()->toDateString(),
            'status' => 'initialisation',
        ])
        ->assertForbidden();
});
