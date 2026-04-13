<?php

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Route;

use App\Enums\UserRole;

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\UserController;

Route::redirect('/', '/login');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    
    // User routes
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    
    // Project routes
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
});

require __DIR__.'/settings.php';
