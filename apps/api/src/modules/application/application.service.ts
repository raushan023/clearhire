import type { DatabaseError } from "pg";

import { pool } from "../../config/database.js";
import type { EmployerApplicationSearchInput, UpdateApplicationStatusInput, ScheduleInterviewInput, RescheduleInterviewInput, RespondToOfferInput } from "./application.schema.js";

export async function applyToJob(
    candidateId: string,
    jobId: string
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const jobResult = await client.query(
            `
                SELECT
                    id,
                    status,
                    application_deadline
                FROM jobs
                WHERE id = $1
                FOR UPDATE
            `,
            [jobId]
        );

        const job = jobResult.rows[0];

        if (!job) {
            throw new Error("JOB_NOT_FOUND");
        }

        if (job.status !== "open") {
            throw new Error("JOB_NOT_OPEN");
        }

        if (
            new Date(job.application_deadline).getTime()
            <= Date.now()
        ) {
            throw new Error("APPLICATION_DEADLINE_PASSED");
        }

        const applicationResult = await client.query(
            `
                INSERT INTO applications (
                    job_id,
                    candidate_id
                )
                VALUES ($1, $2)
                RETURNING
                    id,
                    job_id,
                    candidate_id,
                    status,
                    applied_at
            `,
            [jobId, candidateId]
        );

        const application = applicationResult.rows[0];

        await client.query(
            `
                INSERT INTO application_events (
                    application_id,
                    changed_by,
                    from_status,
                    to_status
                )
                VALUES ($1, $2, NULL, 'applied')
            `,
            [
                application.id,
                candidateId,
            ]
        );

        await client.query("COMMIT");

        return {
            id: application.id,
            jobId: application.job_id,
            candidateId: application.candidate_id,
            status: application.status,
            appliedAt: application.applied_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");

        const databaseError = error as DatabaseError;

        if (
            databaseError.code === "23505"
        ) {
            throw new Error("ALREADY_APPLIED");
        }

        throw error;
    } finally {
        client.release();
    }
}

export async function getCandidateApplications(
    candidateId: string
) {
    const result = await pool.query(
        `
            SELECT
                a.id AS application_id,
                a.status AS application_status,
                a.applied_at,
                a.updated_at,

                j.id AS job_id,
                j.title,
                j.status AS job_status,
                j.application_deadline,
                j.decision_deadline,

                c.id AS company_id,
                c.name AS company_name

            FROM applications a

            INNER JOIN jobs j
                ON j.id = a.job_id

            INNER JOIN companies c
                ON c.id = j.company_id

            WHERE a.candidate_id = $1

            ORDER BY a.applied_at DESC
        `,
        [candidateId]
    );

    return result.rows.map((row) => ({
        id: row.application_id,
        status: row.application_status,
        appliedAt: row.applied_at,
        updatedAt: row.updated_at,

        job: {
            id: row.job_id,
            title: row.title,
            status: row.job_status,

            applicationDeadline:
                row.application_deadline,

            decisionDeadline:
                row.decision_deadline,

            company: {
                id: row.company_id,
                name: row.company_name,
            },
        },
    }));
}

export async function getCandidateApplicationById(
    candidateId: string,
    applicationId: string
) {
    const applicationResult = await pool.query(
        `
            SELECT
                a.id,
                a.status,
                a.applied_at,
                a.updated_at,

                j.id AS job_id,
                j.title,
                j.status AS job_status,
                j.application_deadline,
                j.decision_deadline,

                c.id AS company_id,
                c.name AS company_name

            FROM applications a

            INNER JOIN jobs j
                ON j.id = a.job_id

            INNER JOIN companies c
                ON c.id = j.company_id

            WHERE a.id = $1
              AND a.candidate_id = $2
        `,
        [applicationId, candidateId]
    );

    const application = applicationResult.rows[0];

    if (!application) {
        throw new Error("APPLICATION_NOT_FOUND");
    }

    const eventsResult = await pool.query(
        `
            SELECT
                from_status,
                to_status,
                note,
                created_at
            FROM application_events
            WHERE application_id = $1
            ORDER BY created_at ASC
        `,
        [applicationId]
    );

    const interviewsResult = await pool.query(
        `
        SELECT
            id,
            scheduled_at,
            mode,
            meeting_link,
            location,
            notes,
            status,
    cancelled_at,
    created_at,
    updated_at
        FROM interviews
        WHERE application_id = $1
        ORDER BY scheduled_at ASC
    `,
        [applicationId]
    );

    return {
        id: application.id,
        status: application.status,
        appliedAt: application.applied_at,
        updatedAt: application.updated_at,

        job: {
            id: application.job_id,
            title: application.title,
            status: application.job_status,

            applicationDeadline:
                application.application_deadline,

            decisionDeadline:
                application.decision_deadline,

            company: {
                id: application.company_id,
                name: application.company_name,
            },
        },

        interviews: interviewsResult.rows.map(
            (interview) => ({
                id: interview.id,
                scheduledAt: interview.scheduled_at,
                mode: interview.mode,
                meetingLink: interview.meeting_link,
                location: interview.location,
                notes: interview.notes,
                status: interview.status,
                cancelledAt: interview.cancelled_at,
                createdAt: interview.created_at,
                updatedAt: interview.updated_at,
            })
        ),

        timeline: eventsResult.rows.map((event) => ({
            fromStatus: event.from_status,
            toStatus: event.to_status,
            note: event.note,
            createdAt: event.created_at,
        })),
    };
}

export async function getEmployerJobApplications(
    employerId: string,
    jobId: string,
    input: EmployerApplicationSearchInput
) {
    const membershipResult = await pool.query(
        `
            SELECT
                j.id,
                j.company_id
            FROM jobs j

            INNER JOIN company_members cm
                ON cm.company_id = j.company_id

            WHERE j.id = $1
              AND cm.user_id = $2
        `,
        [jobId, employerId]
    );

    if (membershipResult.rowCount === 0) {
        throw new Error("JOB_ACCESS_DENIED");
    }

    const {
        status,
        page,
        limit,
    } = input;

    const conditions: string[] = [
        "a.job_id = $1",
    ];

    const values: unknown[] = [jobId];

    if (status) {
        values.push(status);

        conditions.push(
            `a.status = $${values.length}`
        );
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
        `
            SELECT COUNT(*)::int AS total
            FROM applications a
            WHERE ${whereClause}
        `,
        values
    );

    const offset = (page - 1) * limit;

    const queryValues = [
        ...values,
        limit,
        offset,
    ];

    const limitParameter =
        `$${values.length + 1}`;

    const offsetParameter =
        `$${values.length + 2}`;

    const result = await pool.query(
        `
            SELECT
                a.id AS application_id,
                a.status,
                a.applied_at,
                a.updated_at,

                u.id AS candidate_id,
                u.first_name,
                u.last_name,
                u.email

            FROM applications a

            INNER JOIN users u
                ON u.id = a.candidate_id

            WHERE ${whereClause}

            ORDER BY a.applied_at DESC

            LIMIT ${limitParameter}
            OFFSET ${offsetParameter}
        `,
        queryValues
    );

    const applications = result.rows.map((row) => ({
        id: row.application_id,
        status: row.status,
        appliedAt: row.applied_at,
        updatedAt: row.updated_at,

        candidate: {
            id: row.candidate_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
        },
    }));

    const total = countResult.rows[0].total;

    return {
        applications,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

type ApplicationStatus =
    | "applied"
    | "under_review"
    | "shortlisted"
    | "interview"
    | "final_review"
    | "offer"
    | "offer_accepted"
    | "offer_declined"
    | "rejected"
    | "withdrawn";

const employerTransitions: Record<
    ApplicationStatus,
    ApplicationStatus[]
> = {
    applied: [
        "under_review",
        "rejected",
    ],

    under_review: [
        "shortlisted",
        "rejected",
    ],

    shortlisted: [
        "interview",
        "rejected",
    ],

    interview: [
        "final_review",
        "rejected",
    ],

    final_review: [
        "offer",
        "rejected",
    ],

    offer: [],
    offer_accepted: [],
    offer_declined: [],
    rejected: [],
    withdrawn: [],
};

function getApplicationStatusNotification(
    status: ApplicationStatus,
    jobTitle: string
) {
    switch (status) {
        case "under_review":
            return {
                title: "Application under review",
                message:
                    `Your application for ${jobTitle} is now under review.`,
            };

        case "shortlisted":
            return {
                title: "You have been shortlisted",
                message:
                    `You have been shortlisted for ${jobTitle}.`,
            };

        case "interview":
            return {
                title: "Interview stage",
                message:
                    `Your application for ${jobTitle} has moved to the interview stage.`,
            };

        case "final_review":
            return {
                title: "Application in final review",
                message:
                    `Your application for ${jobTitle} is now in final review.`,
            };

        case "offer":
            return {
                title: "Offer received",
                message:
                    `You have received an offer for ${jobTitle}.`,
            };

        case "rejected":
            return {
                title: "Application update",
                message:
                    `Your application for ${jobTitle} was not selected.`,
            };

        default:
            return {
                title: "Application updated",
                message:
                    `Your application for ${jobTitle} has been updated.`,
            };
    }
}

export async function updateApplicationStatus(
    employerId: string,
    applicationId: string,
    input: UpdateApplicationStatusInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
                SELECT
                    a.id,
                    a.status,
                    a.job_id,
                    a.candidate_id,

                    j.company_id,
                    j.title AS job_title
                    j.openings

                FROM applications a

                INNER JOIN jobs j
                    ON j.id = a.job_id

                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id

                WHERE a.id = $1
                  AND cm.user_id = $2

                FOR UPDATE
            `,
            [
                applicationId,
                employerId,
            ]
        );

        const application = result.rows[0];

        if (!application) {
            throw new Error("APPLICATION_ACCESS_DENIED");
        }

        const currentStatus =
            application.status as ApplicationStatus;

        const newStatus =
            input.status as ApplicationStatus;

        const allowedTransitions =
            employerTransitions[currentStatus];

        if (!allowedTransitions.includes(newStatus)) {
            throw new Error("INVALID_STATUS_TRANSITION");
        }

        if (newStatus === "offer") {
            const offerCountResult = await client.query(
                `
            SELECT COUNT(*)::int AS count
            FROM applications
            WHERE job_id = $1
              AND status IN (
                  'offer',
                  'offer_accepted'
              )
              AND id <> $2
        `,
                [
                    application.job_id,
                    applicationId,
                ]
            );

            const activeOfferCount =
                offerCountResult.rows[0].count;

            if (activeOfferCount >= application.openings) {
                throw new Error(
                    "NO_OPENINGS_AVAILABLE"
                );
            }
        }

        const updatedResult = await client.query(
            `
                UPDATE applications
                SET
                    status = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    job_id,
                    candidate_id,
                    status,
                    applied_at,
                    updated_at
            `,
            [
                newStatus,
                applicationId,
            ]
        );

        await client.query(
            `
                INSERT INTO application_events (
                    application_id,
                    changed_by,
                    from_status,
                    to_status,
                    note
                )
                VALUES ($1, $2, $3, $4, $5)
            `,
            [
                applicationId,
                employerId,
                currentStatus,
                newStatus,
                input.note ?? null,
            ]
        );

        const notificationContent =
            getApplicationStatusNotification(
                newStatus,
                application.job_title
            );

        await client.query(
            `
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            job_id,
            application_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
    `,
            [
                application.candidate_id,
                "application_status_changed",
                notificationContent.title,
                notificationContent.message,
                application.job_id,
                applicationId,
            ]
        );

        await client.query("COMMIT");

        const updated =
            updatedResult.rows[0];

        return {
            id: updated.id,
            jobId: updated.job_id,
            candidateId: updated.candidate_id,
            status: updated.status,
            appliedAt: updated.applied_at,
            updatedAt: updated.updated_at,
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function withdrawApplication(
    candidateId: string,
    applicationId: string
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
                SELECT
                    id,
                    status,
                    candidate_id
                FROM applications
                WHERE id = $1
                  AND candidate_id = $2
                FOR UPDATE
            `,
            [
                applicationId,
                candidateId,
            ]
        );

        const application = result.rows[0];

        if (!application) {
            throw new Error("APPLICATION_NOT_FOUND");
        }

        if (
            ["offer", "rejected", "withdrawn"].includes(
                application.status
            )
        ) {
            throw new Error("APPLICATION_NOT_WITHDRAWABLE");
        }

        const previousStatus = application.status;

        const updatedResult = await client.query(
            `
                UPDATE applications
                SET
                    status = 'withdrawn',
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id,
                    job_id,
                    candidate_id,
                    status,
                    applied_at,
                    updated_at
            `,
            [applicationId]
        );

        await client.query(
            `
                INSERT INTO application_events (
                    application_id,
                    changed_by,
                    from_status,
                    to_status
                )
                VALUES ($1, $2, $3, 'withdrawn')
            `,
            [
                applicationId,
                candidateId,
                previousStatus,
            ]
        );

        await client.query("COMMIT");

        const updated =
            updatedResult.rows[0];

        return {
            id: updated.id,
            jobId: updated.job_id,
            candidateId: updated.candidate_id,
            status: updated.status,
            appliedAt: updated.applied_at,
            updatedAt: updated.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getEmployerFeedbackObligations(
    employerId: string
) {
    const result = await pool.query(
        `
            SELECT
                a.id AS application_id,
                a.status AS application_status,
                a.applied_at,
                a.updated_at,

                u.id AS candidate_id,
                u.first_name,
                u.last_name,
                u.email,

                j.id AS job_id,
                j.title AS job_title,
                j.decision_deadline,
                j.decision_deadline_missed_at,

                c.id AS company_id,
                c.name AS company_name

            FROM applications a

            INNER JOIN jobs j
                ON j.id = a.job_id

            INNER JOIN companies c
                ON c.id = j.company_id

            INNER JOIN company_members cm
                ON cm.company_id = j.company_id

            INNER JOIN users u
                ON u.id = a.candidate_id

            WHERE cm.user_id = $1

              AND j.decision_deadline_missed_at IS NOT NULL

              AND a.status IN (
                  'applied',
                  'under_review',
                  'shortlisted',
                  'interview',
                  'final_review',
                  'offer
              )
                  

            ORDER BY
                j.decision_deadline ASC,
                a.applied_at ASC
        `,
        [employerId]
    );

    return result.rows.map((row) => ({
        applicationId: row.application_id,

        status: row.application_status,

        candidate: {
            id: row.candidate_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
        },

        job: {
            id: row.job_id,
            title: row.job_title,

            company: {
                id: row.company_id,
                name: row.company_name,
            },

            decisionDeadline:
                row.decision_deadline,

            decisionDeadlineMissedAt:
                row.decision_deadline_missed_at,
        },

        appliedAt: row.applied_at,
        updatedAt: row.updated_at,
    }));
}

export async function scheduleInterview(
    employerId: string,
    applicationId: string,
    input: ScheduleInterviewInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const applicationResult =
            await client.query(
                `
                    SELECT
                        a.id,
                        a.status,
                        a.candidate_id,
                        a.job_id,

                        j.title AS job_title,
                        j.company_id

                    FROM applications a

                    INNER JOIN jobs j
                        ON j.id = a.job_id

                    INNER JOIN company_members cm
                        ON cm.company_id = j.company_id

                    WHERE a.id = $1
                      AND cm.user_id = $2

                    FOR UPDATE
                `,
                [
                    applicationId,
                    employerId,
                ]
            );

        const application =
            applicationResult.rows[0];

        if (!application) {
            throw new Error(
                "APPLICATION_ACCESS_DENIED"
            );
        }

        if (application.status !== "interview") {
            throw new Error(
                "APPLICATION_NOT_IN_INTERVIEW_STAGE"
            );
        }

        const interviewResult =
            await client.query(
                `
                    INSERT INTO interviews (
                        application_id,
                        scheduled_by,
                        scheduled_at,
                        mode,
                        meeting_link,
                        location,
                        notes
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7
                    )
                    RETURNING
                        id,
                        application_id,
                        scheduled_at,
                        mode,
                        meeting_link,
                        location,
                        notes,
                        created_at
                `,
                [
                    applicationId,
                    employerId,
                    input.scheduledAt,
                    input.mode,
                    input.meetingLink ?? null,
                    input.location ?? null,
                    input.notes ?? null,
                ]
            );

        const interview =
            interviewResult.rows[0];

        await client.query(
            `
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    job_id,
                    application_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                application.candidate_id,
                "interview_scheduled",
                "Interview scheduled",
                `An interview has been scheduled for ${application.job_title}.`,
                application.job_id,
                applicationId,
            ]
        );

        await client.query("COMMIT");

        return {
            id: interview.id,
            applicationId:
                interview.application_id,
            scheduledAt:
                interview.scheduled_at,
            mode: interview.mode,
            meetingLink:
                interview.meeting_link,
            location:
                interview.location,
            notes: interview.notes,
            createdAt:
                interview.created_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function rescheduleInterview(
    employerId: string,
    interviewId: string,
    input: RescheduleInterviewInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const interviewResult = await client.query(
            `
                SELECT
                    i.id,
                    i.application_id,
                    i.scheduled_at,
                    i.mode,
                    i.meeting_link,
                    i.location,
                    i.notes,
                    i.status,

                    a.candidate_id,
                    a.job_id,

                    j.title AS job_title

                FROM interviews i

                INNER JOIN applications a
                    ON a.id = i.application_id

                INNER JOIN jobs j
                    ON j.id = a.job_id

                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id

                WHERE i.id = $1
                  AND cm.user_id = $2

                FOR UPDATE
            `,
            [
                interviewId,
                employerId,
            ]
        );

        const interview =
            interviewResult.rows[0];

        if (!interview) {
            throw new Error(
                "INTERVIEW_ACCESS_DENIED"
            );
        }

        if (interview.status === "cancelled") {
            throw new Error(
                "INTERVIEW_CANCELLED"
            );
        }

        const updatedResult = await client.query(
            `
                UPDATE interviews
                SET
                    scheduled_at = $1,
                    mode = $2,
                    meeting_link = $3,
                    location = $4,
                    notes = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING
                    id,
                    application_id,
                    scheduled_at,
                    mode,
                    meeting_link,
                    location,
                    notes,
                    status,
                    updated_at
            `,
            [
                input.scheduledAt,
                input.mode,
                input.meetingLink ?? null,
                input.location ?? null,
                input.notes ?? null,
                interviewId,
            ]
        );

        await client.query(
            `
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    job_id,
                    application_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                interview.candidate_id,
                "interview_rescheduled",
                "Interview rescheduled",
                `Your interview for ${interview.job_title} has been rescheduled.`,
                interview.job_id,
                interview.application_id,
            ]
        );

        await client.query("COMMIT");

        const updated =
            updatedResult.rows[0];

        return {
            id: updated.id,
            applicationId:
                updated.application_id,
            scheduledAt:
                updated.scheduled_at,
            mode: updated.mode,
            meetingLink:
                updated.meeting_link,
            location:
                updated.location,
            notes: updated.notes,
            status: updated.status,
            updatedAt:
                updated.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function cancelInterview(
    employerId: string,
    interviewId: string
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
                SELECT
                    i.id,
                    i.application_id,
                    i.status,

                    a.candidate_id,
                    a.job_id,

                    j.title AS job_title

                FROM interviews i

                INNER JOIN applications a
                    ON a.id = i.application_id

                INNER JOIN jobs j
                    ON j.id = a.job_id

                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id

                WHERE i.id = $1
                  AND cm.user_id = $2

                FOR UPDATE
            `,
            [
                interviewId,
                employerId,
            ]
        );

        const interview = result.rows[0];

        if (!interview) {
            throw new Error(
                "INTERVIEW_ACCESS_DENIED"
            );
        }

        if (interview.status === "cancelled") {
            throw new Error(
                "INTERVIEW_ALREADY_CANCELLED"
            );
        }

        const updatedResult = await client.query(
            `
                UPDATE interviews
                SET
                    status = 'cancelled',
                    cancelled_at = NOW(),
                    cancelled_by = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    application_id,
                    scheduled_at,
                    status,
                    cancelled_at,
                    updated_at
            `,
            [
                employerId,
                interviewId,
            ]
        );

        await client.query(
            `
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    job_id,
                    application_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                interview.candidate_id,
                "interview_cancelled",
                "Interview cancelled",
                `Your interview for ${interview.job_title} has been cancelled.`,
                interview.job_id,
                interview.application_id,
            ]
        );

        await client.query("COMMIT");

        const updated =
            updatedResult.rows[0];

        return {
            id: updated.id,
            applicationId:
                updated.application_id,
            scheduledAt:
                updated.scheduled_at,
            status: updated.status,
            cancelledAt:
                updated.cancelled_at,
            updatedAt:
                updated.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function respondToOffer(
    candidateId: string,
    applicationId: string,
    input: RespondToOfferInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const applicationResult = await client.query(
            `
                SELECT
                    a.id,
                    a.status,
                    a.job_id,
                    a.candidate_id,

                    j.title AS job_title,
                    j.company_id

                FROM applications a

                INNER JOIN jobs j
                    ON j.id = a.job_id

                WHERE a.id = $1
                  AND a.candidate_id = $2

                FOR UPDATE
            `,
            [
                applicationId,
                candidateId,
            ]
        );

        const application =
            applicationResult.rows[0];

        if (!application) {
            throw new Error(
                "APPLICATION_NOT_FOUND"
            );
        }

        if (application.status !== "offer") {
            throw new Error(
                "APPLICATION_NOT_IN_OFFER_STAGE"
            );
        }

        const updatedResult = await client.query(
            `
                UPDATE applications
                SET
                    status = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    job_id,
                    candidate_id,
                    status,
                    applied_at,
                    updated_at
            `,
            [
                input.response,
                applicationId,
            ]
        );

        await client.query(
            `
                INSERT INTO application_events (
                    application_id,
                    changed_by,
                    from_status,
                    to_status
                )
                VALUES ($1, $2, 'offer', $3)
            `,
            [
                applicationId,
                candidateId,
                input.response,
            ]
        );

        await client.query(
            `
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    job_id,
                    application_id
                )

                SELECT
                    cm.user_id,
                    $1,
                    $2,
                    $3,
                    $4,
                    $5

                FROM company_members cm

                WHERE cm.company_id = $6
            `,
            [
                "offer_response",
                input.response === "offer_accepted"
                    ? "Offer accepted"
                    : "Offer declined",

                input.response === "offer_accepted"
                    ? `A candidate has accepted the offer for ${application.job_title}.`
                    : `A candidate has declined the offer for ${application.job_title}.`,

                application.job_id,
                applicationId,
                application.company_id,
            ]
        );

        await client.query("COMMIT");

        const updated =
            updatedResult.rows[0];

        return {
            id: updated.id,
            jobId: updated.job_id,
            candidateId:
                updated.candidate_id,
            status: updated.status,
            appliedAt:
                updated.applied_at,
            updatedAt:
                updated.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}