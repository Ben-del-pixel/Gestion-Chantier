<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('notifications settings page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('notifications.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/notifications')
        );
});

test('appearance settings page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('appearance.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/appearance')
        );
});

test('data settings page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('data.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/data')
        );
});
