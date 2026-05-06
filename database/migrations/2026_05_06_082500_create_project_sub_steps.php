<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_sub_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_step_id')->constrained('project_steps')->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('chef_chantier_id')->constrained('users');
            $table->date('planned_date');
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->timestamps();
        });

        // Table pivot pour assigner des ouvriers aux sous-étapes
        Schema::create('project_sub_step_worker', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_sub_step_id')->constrained('project_sub_steps')->onDelete('cascade');
            $table->foreignId('worker_id')->constrained('users');
            $table->boolean('is_completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_sub_step_worker');
        Schema::dropIfExists('project_sub_steps');
    }
};
