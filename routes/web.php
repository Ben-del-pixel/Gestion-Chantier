<?php

use App\Http\Controllers\AbsenceNotificationController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\Api\FilterController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AttendanceInitializationController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    // User routes
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

    // Project routes
    Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::get('projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
    Route::put('projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');

    // Material routes
    Route::get('materials', [MaterialController::class, 'index'])->name('materials.index');
    Route::post('materials', [MaterialController::class, 'store'])->name('materials.store');

    // Activity Log routes
    Route::get('activity-logs', [ActivityLogController::class, 'index'])->name('activity-logs.index');

    // Report routes
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::post('reports/generate', [ReportController::class, 'generate'])->name('reports.generate');

    // API routes
    Route::get('api/projects', [FilterController::class, 'projects']);
    Route::get('api/workers', [FilterController::class, 'workers']);

    // Attendance routes
    Route::get('attendance', [AttendanceController::class, 'index'])->name('attendance.index');
    Route::post('attendance/check-in', [AttendanceController::class, 'checkIn'])->name('attendance.check-in');
    Route::put('attendance/{attendance}/check-out', [AttendanceController::class, 'checkOut'])->name('attendance.check-out');
    Route::put('attendance/{attendance}/status', [AttendanceController::class, 'updateStatus'])->name('attendance.update-status');
    Route::get('attendance/worker/{worker}', [AttendanceController::class, 'workerOverview'])->name('attendance.worker');
    Route::get('attendance/monthly', [AttendanceController::class, 'monthlyOverview'])->name('attendance.monthly');

    // Attendance Initialization routes (API)
    Route::post('api/attendance/initialize', [AttendanceInitializationController::class, 'initializeForProject']);
    Route::get('api/attendance/list', [AttendanceController::class, 'apiList']);
    Route::post('api/projects/{project}/workers', [AttendanceInitializationController::class, 'assignWorkers']);
    Route::get('api/workers/available', [AttendanceInitializationController::class, 'getAvailableWorkers']);
    Route::get('api/projects/{project}/workers', [AttendanceInitializationController::class, 'getProjectWorkers']);

    // Absence Notification routes
    Route::get('absences', [AbsenceNotificationController::class, 'index'])->name('absences.index');
    Route::get('absences/{absenceNotification}', [AbsenceNotificationController::class, 'show'])->name('absences.show');
    Route::post('absences/{absenceNotification}/read', [AbsenceNotificationController::class, 'markAsRead'])->name('absences.read');
    Route::post('absences/{absenceNotification}/resolve', [AbsenceNotificationController::class, 'resolve'])->name('absences.resolve');
    Route::get('api/absences/pending', [AbsenceNotificationController::class, 'getPendingAbsences']);
    Route::get('api/absences/filter', [AbsenceNotificationController::class, 'filter']);
});

require __DIR__.'/settings.php';
