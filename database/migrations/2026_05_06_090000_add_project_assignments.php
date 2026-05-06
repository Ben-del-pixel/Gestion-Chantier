<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ajouter chef_chantier_id et storekeeper_id à projects
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'chef_chantier_id')) {
                $table->foreignId('chef_chantier_id')->nullable()->after('engineer_id')->constrained('users');
            }
            if (!Schema::hasColumn('projects', 'storekeeper_id')) {
                $table->foreignId('storekeeper_id')->nullable()->after('chef_chantier_id')->constrained('users');
            }
        });

        // Table pour lier les ouvriers aux projets via leur chef de chantier
        if (!Schema::hasTable('project_workers')) {
            Schema::create('project_workers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
                $table->foreignId('worker_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('chef_chantier_id')->constrained('users');
                $table->timestamps();

                $table->unique(['project_id', 'worker_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_workers');
        
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'storekeeper_id')) {
                $table->dropForeign(['storekeeper_id']);
                $table->dropColumn('storekeeper_id');
            }
            if (Schema::hasColumn('projects', 'chef_chantier_id')) {
                $table->dropForeign(['chef_chantier_id']);
                $table->dropColumn('chef_chantier_id');
            }
        });
    }
};
