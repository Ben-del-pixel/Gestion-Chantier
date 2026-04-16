import React from 'react';
import { usePage, Head } from '@inertiajs/react';
import { ManagerDashboard, EngineerDashboard, WorkerDashboard } from '@/components/dashboards';
import { UserRole } from '@/Enums/UserRole';

export default function Dashboard({ projects, stats, tasks }: any) {
    const pageProps = usePage().props as any;
    const { auth } = pageProps;
    const roleValue = auth.user?.role;

    return (
        <>
            <Head title="Tableau de bord" />

            <div className="w-full max-w-7xl mx-auto space-y-6">
                {roleValue === UserRole.Manager.value && <ManagerDashboard projects={projects} stats={stats} />}
                {roleValue === UserRole.Engineer.value && (
                    <EngineerDashboard
                        tasks={tasks}
                        stats={stats}
                        attendanceProjects={pageProps.attendanceProjects}
                        attendanceWorkers={pageProps.attendanceWorkers}
                        attendanceStatuses={pageProps.attendanceStatuses}
                        attendanceShifts={pageProps.attendanceShifts}
                        attendanceDate={pageProps.attendanceDate}
                    />
                )}
                {roleValue === UserRole.Worker.value && (
                    <WorkerDashboard
                        tasks={tasks}
                        workerAttendances={pageProps.workerAttendances}
                        workerAttendanceSummary={pageProps.workerAttendanceSummary}
                    />
                )}

                {!Object.values(UserRole).some(r => r.value === roleValue) && (
                    <div className="bg-card text-card-foreground rounded-xl border p-12 text-center shadow-sm">
                        <p className="text-muted-foreground font-medium text-sm">
                            Accès restreint ou rôle non configuré : <span className="text-foreground font-bold">{roleValue}</span>
                        </p>
                    </div>
                )}
            </div>
        </>
    );
} 