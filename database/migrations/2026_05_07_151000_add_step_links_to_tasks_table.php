<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('project_step_id')
                ->nullable()
                ->after('project_id')
                ->constrained('project_steps')
                ->nullOnDelete();
            $table->foreignId('project_sub_step_id')
                ->nullable()
                ->after('project_step_id')
                ->constrained('project_sub_steps')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_sub_step_id');
            $table->dropConstrainedForeignId('project_step_id');
        });
    }
};
