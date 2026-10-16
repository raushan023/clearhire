import type { Response } from "express";

import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import { jobIdParamSchema } from "../job/job.schema.js";
import {
    applyToJob, getCandidateApplicationById,
    getCandidateApplications,
    getEmployerJobApplications,
    updateApplicationStatus,
    withdrawApplication,
    getEmployerFeedbackObligations,
    scheduleInterview,
    rescheduleInterview,
    cancelInterview,
    respondToOffer
} from "./application.service.js";

import {
    applicationIdParamSchema,
    employerApplicationSearchSchema,
    scheduleInterviewSchema,
    updateApplicationStatusSchema,
    interviewIdParamSchema,
    rescheduleInterviewSchema,
    respondToOfferSchema
} from "./application.schema.js";

export async function applyToJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult = jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    try {
        const application = await applyToJob(
            req.user.id,
            paramsResult.data.jobId
        );

        return res.status(201).json({
            message: "Application submitted successfully",
            application,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "JOB_NOT_FOUND":
                    return res.status(404).json({
                        message: "Job not found",
                    });

                case "JOB_NOT_OPEN":
                    return res.status(409).json({
                        message:
                            "This job is not accepting applications",
                    });

                case "APPLICATION_DEADLINE_PASSED":
                    return res.status(409).json({
                        message:
                            "The application deadline has passed",
                    });

                case "ALREADY_APPLIED":
                    return res.status(409).json({
                        message:
                            "You have already applied to this job",
                    });
            }
        }

        console.error("Job application failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getMyApplicationsController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    try {
        const applications =
            await getCandidateApplications(req.user.id);

        return res.status(200).json({
            applications,
        });
    } catch (error) {
        console.error(
            "Fetching candidate applications failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getMyApplicationController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        applicationIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid application ID",
        });
    }

    try {
        const application =
            await getCandidateApplicationById(
                req.user.id,
                paramsResult.data.applicationId
            );

        return res.status(200).json({
            application,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "APPLICATION_NOT_FOUND"
        ) {
            return res.status(404).json({
                message: "Application not found",
            });
        }

        console.error(
            "Fetching application failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getEmployerJobApplicationsController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    const queryResult =
        employerApplicationSearchSchema.safeParse(
            req.query
        );

    if (!queryResult.success) {
        return res.status(400).json({
            message: "Invalid search parameters",
            errors:
                queryResult.error.flatten().fieldErrors,
        });
    }

    try {
        const result =
            await getEmployerJobApplications(
                req.user.id,
                paramsResult.data.jobId,
                queryResult.data
            );

        return res.status(200).json(result);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "JOB_ACCESS_DENIED"
        ) {
            return res.status(403).json({
                message:
                    "You do not have access to this job",
            });
        }

        console.error(
            "Fetching job applications failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function updateApplicationStatusController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        applicationIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid application ID",
        });
    }

    const bodyResult =
        updateApplicationStatusSchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({
            message: "Invalid application status data",
            errors:
                bodyResult.error.flatten().fieldErrors,
        });
    }

    try {
        const application =
            await updateApplicationStatus(
                req.user.id,
                paramsResult.data.applicationId,
                bodyResult.data
            );

        return res.status(200).json({
            message:
                "Application status updated successfully",
            application,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "APPLICATION_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this application",
                    });

                case "INVALID_STATUS_TRANSITION":
                    return res.status(409).json({
                        message:
                            "This application status transition is not allowed",
                    });

                case "NO_OPENINGS_AVAILABLE":
                    return res.status(409).json({
                        message:
                            "All available openings already have active or accepted offers",
                    });
            }
        }

        console.error(
            "Application status update failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function withdrawApplicationController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        applicationIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid application ID",
        });
    }

    try {
        const application =
            await withdrawApplication(
                req.user.id,
                paramsResult.data.applicationId
            );

        return res.status(200).json({
            message: "Application withdrawn successfully",
            application,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "APPLICATION_NOT_FOUND":
                    return res.status(404).json({
                        message: "Application not found",
                    });

                case "APPLICATION_NOT_WITHDRAWABLE":
                    return res.status(409).json({
                        message:
                            "This application can no longer be withdrawn",
                    });
            }
        }

        console.error(
            "Application withdrawal failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getEmployerFeedbackObligationsController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    try {
        const obligations =
            await getEmployerFeedbackObligations(
                req.user.id
            );

        return res.status(200).json({
            overdueCount: obligations.length,
            obligations,
        });
    } catch (error) {
        console.error(
            "Fetching employer feedback obligations failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function scheduleInterviewController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        applicationIdParamSchema.safeParse(
            req.params
        );

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid application ID",
        });
    }

    const bodyResult =
        scheduleInterviewSchema.safeParse(
            req.body
        );

    if (!bodyResult.success) {
        return res.status(400).json({
            message: "Invalid interview data",
            errors:
                bodyResult.error.flatten()
                    .fieldErrors,
        });
    }

    try {
        const interview =
            await scheduleInterview(
                req.user.id,
                paramsResult.data.applicationId,
                bodyResult.data
            );

        return res.status(201).json({
            message:
                "Interview scheduled successfully",
            interview,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "APPLICATION_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this application",
                    });

                case "APPLICATION_NOT_IN_INTERVIEW_STAGE":
                    return res.status(409).json({
                        message:
                            "Interview can only be scheduled for applications in the interview stage",
                    });
            }
        }

        console.error(
            "Scheduling interview failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function rescheduleInterviewController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        interviewIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid interview ID",
        });
    }

    const bodyResult =
        rescheduleInterviewSchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({
            message: "Invalid interview data",
            errors:
                bodyResult.error.flatten().fieldErrors,
        });
    }

    try {
        const interview =
            await rescheduleInterview(
                req.user.id,
                paramsResult.data.interviewId,
                bodyResult.data
            );

        return res.status(200).json({
            message:
                "Interview rescheduled successfully",
            interview,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "INTERVIEW_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this interview",
                    });

                case "INTERVIEW_CANCELLED":
                    return res.status(409).json({
                        message:
                            "A cancelled interview cannot be rescheduled",
                    });
            }
        }

        console.error(
            "Interview rescheduling failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function cancelInterviewController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        interviewIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid interview ID",
        });
    }

    try {
        const interview =
            await cancelInterview(
                req.user.id,
                paramsResult.data.interviewId
            );

        return res.status(200).json({
            message:
                "Interview cancelled successfully",
            interview,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "INTERVIEW_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this interview",
                    });

                case "INTERVIEW_ALREADY_CANCELLED":
                    return res.status(409).json({
                        message:
                            "Interview is already cancelled",
                    });
            }
        }

        console.error(
            "Interview cancellation failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function respondToOfferController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message:
                "Authentication required",
        });
    }

    const paramsResult =
        applicationIdParamSchema.safeParse(
            req.params
        );

    if (!paramsResult.success) {
        return res.status(400).json({
            message:
                "Invalid application ID",
        });
    }

    const bodyResult =
        respondToOfferSchema.safeParse(
            req.body
        );

    if (!bodyResult.success) {
        return res.status(400).json({
            message:
                "Invalid offer response",
            errors:
                bodyResult.error.flatten()
                    .fieldErrors,
        });
    }

    try {
        const application =
            await respondToOffer(
                req.user.id,
                paramsResult.data
                    .applicationId,
                bodyResult.data
            );

        return res.status(200).json({
            message:
                bodyResult.data.response ===
                    "offer_accepted"
                    ? "Offer accepted successfully"
                    : "Offer declined successfully",

            application,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "APPLICATION_NOT_FOUND":
                    return res.status(404).json({
                        message:
                            "Application not found",
                    });

                case "APPLICATION_NOT_IN_OFFER_STAGE":
                    return res.status(409).json({
                        message:
                            "This application does not have an active offer",
                    });
            }
        }

        console.error(
            "Offer response failed:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error",
        });
    }
}