import { usePage, Head } from '@inertiajs/react';
import React from 'react';
import { ManagerDashboard, EngineerDashboard, WorkerDashboard } from '@/components/dashboards';
import { UserRole } from '@/Enums/UserRole';

export default function Dashboard({ stats, tasks, projects, recentActivities, materialDistribution, ...props }: any) {
    const pageProps = usePage().props as any;
    const { auth } = pageProps;
    const roleValue = auth.user?.role;

    return (
        <>
            <Head title="Tableau de bord" />

            <div className="relative w-full max-w-screen-2xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_28%)]" />
                {roleValue === UserRole.Manager.value && (
                    <ManagerDashboard 
                        projects={projects} 
                        stats={stats} 
                        recentActivities={recentActivities}
                        materialDistribution={materialDistribution}
                    />
                )}
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
                        workerIncidents={pageProps.workerIncidents}
                    />
                )}

                {!Object.values(UserRole).some(r => r.value === roleValue) && (
                    <div className="rounded-3xl border border-border/60 bg-background/90 p-12 text-center shadow-[0_24px_80px_-48px_rgba(15,23,42,0.42)] backdrop-blur-xl">
                        <p className="text-muted-foreground font-medium text-sm">
                            Accès restreint ou rôle non configuré : <span className="text-foreground font-bold">{roleValue}</span>
                        </p>
                    </div>
                )}
            </div>
        </>
    );
} 