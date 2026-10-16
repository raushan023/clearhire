// These expressions run in the mutation statement, with the parent job already
// locked. PostgreSQL SET expressions see the old row; CTEs see the same original
// application snapshot. No round-trip gap can erase a just-crossed deadline.
const missedDeadlineCondition = `decision_deadline < statement_timestamp()
    AND decision_deadline_missed_at IS NULL
    AND status IN ('open', 'applications_closed', 'hiring_in_progress')
    AND EXISTS (SELECT 1 FROM applications a WHERE a.job_id = jobs.id
        AND a.status IN ('applied', 'under_review', 'shortlisted', 'interview', 'final_review', 'offer'))`;

export const missedDeadlineValue = `CASE WHEN ${missedDeadlineCondition}
    THEN decision_deadline ELSE decision_deadline_missed_at END`;

// Only SQL placeholders supplied by these internal application mutations.
// A data-modifying CTE executes even when its RETURNING rows are not consumed.
export function missedDeadlineCte(jobIdParameter: '$2' | '$3'): string {
    return `WITH missed_deadline AS (
        UPDATE jobs SET decision_deadline_missed_at = decision_deadline, updated_at = NOW()
        WHERE id = ${jobIdParameter} AND ${missedDeadlineCondition} RETURNING id
    )`;
}
