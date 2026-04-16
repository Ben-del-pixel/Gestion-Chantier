<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            // Only add shift if it doesn't exist
            if (!Schema::hasColumn('attendances', 'shift')) {
                $table->enum('shift', ['morning', 'evening'])->default('morning')->after('date');
            }
        });

        // Remove duplicate records, keeping only the first one per (user_id, project_id, date, shift)
        DB::statement('
            DELETE FROM attendances WHERE id NOT IN (
                SELECT MIN(id) FROM attendances GROUP BY user_id, project_id, date, shift
            )
        ');

        // Add unique constraint
        Schema::table('attendances', function (Blueprint $table) {
            try {
                $table->unique(['user_id', 'project_id', 'date', 'shift']);
            } catch (\Exception $e) {
                // Index might already exist
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            // Drop constraint if exists
            try {
                $table->dropUnique(['user_id', 'project_id', 'date', 'shift']);
            } catch (\Exception $e) {
                // Constraint might not exist
            }
            // Drop column if exists
            if (Schema::hasColumn('attendances', 'shift')) {
                $table->dropColumn('shift');
            }
        });
    }
};
