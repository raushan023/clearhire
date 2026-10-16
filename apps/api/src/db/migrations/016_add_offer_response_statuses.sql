ALTER TABLE applications
DROP CONSTRAINT applications_status_check;

ALTER TABLE applications
ADD CONSTRAINT applications_status_check
CHECK (
    status IN (
        'applied',
        'under_review',
        'shortlisted',
        'interview',
        'final_review',
        'offer',
        'offer_accepted',
        'offer_declined',
        'rejected',
        'withdrawn'
    )
);


ALTER TABLE application_events
DROP CONSTRAINT application_events_from_status_check;

ALTER TABLE application_events
ADD CONSTRAINT application_events_from_status_check
CHECK (
    from_status IS NULL
    OR from_status IN (
        'applied',
        'under_review',
        'shortlisted',
        'interview',
        'final_review',
        'offer',
        'offer_accepted',
        'offer_declined',
        'rejected',
        'withdrawn'
    )
);


ALTER TABLE application_events
DROP CONSTRAINT application_events_to_status_check;

ALTER TABLE application_events
ADD CONSTRAINT application_events_to_status_check
CHECK (
    to_status IN (
        'applied',
        'under_review',
        'shortlisted',
        'interview',
        'final_review',
        'offer',
        'offer_accepted',
        'offer_declined',
        'rejected',
        'withdrawn'
    )
);